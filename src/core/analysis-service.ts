import{normalizeWeights}from'./weight-service';
import{VALUE_KEYS,VALUE_LABELS,isImpactUnknown,unknownKeysOf,type DecisionAnalysis,type DecisionDraft,type GapRef,type Horizon,type OptionAnalysis,type RegretPoint,type RehearsalCard,type ValueKey,type ValueWeights}from'./models';

const timeFactor:Record<Horizon,Record<ValueKey,number>>={1:{stability:1.2,growth:.75,freedom:.8,money:1.15},5:{stability:1,growth:1,freedom:1,money:1},10:{stability:.8,growth:1.25,freedom:1.2,money:.85}};
const HORIZONS=[1,5,10]as Horizon[];
const CLOSENESS=5;

// 单个时间点：已知维度给确定贡献；未知维度的影响可能是 -5..+5，
// 对应后悔贡献区间 [0, 权重*时间系数]（绝不按 0 影响=中性 5/10 计入）。
function point(option:DecisionDraft['options'][number],weights:ValueWeights,horizon:Horizon):RegretPoint{
  const unknown=unknownKeysOf(option);
  const breakdown={}as ValueWeights;
  let known=0;let unknownRange=0;
  for(const key of VALUE_KEYS){
    const factor=weights[key]*timeFactor[horizon][key];
    if(isImpactUnknown(option,key)){
      // 影响 ∈ [-5,+5] ⇒ negative ∈ [0,1] ⇒ 贡献 ∈ [0,factor]
      unknownRange+=factor;
      breakdown[key]=0;
    }else{
      const value=(5-option.impacts[key])/10*factor;
      breakdown[key]=Math.round(value*10)/10;
      known+=value;
    }
  }
  const irreversible=(100-option.reversibility)*.08*(horizon/10);
  const clamp=(n:number)=>Math.max(0,Math.min(100,n));
  return{
    horizon,
    min:Math.round(clamp(known+irreversible)),
    max:Math.round(clamp(known+unknownRange+irreversible)),
    score:Math.round(clamp(known+unknownRange/2+irreversible)),
    breakdown,
    unknownKeys:unknown,
  };
}

// 预演卡：若该时间点“最可能遗憾的维度”本身尚未判断，则生成条件式卡片并显式标注。
function card(option:DecisionDraft['options'][number],p:RegretPoint,weights:ValueWeights):RehearsalCard{
  const potential=(k:ValueKey)=>isImpactUnknown(option,k)?weights[k]*5:weights[k]*(5-option.impacts[k]);
  const key=VALUE_KEYS.slice().sort((a,b)=>potential(b)-potential(a))[0];
  const label=VALUE_LABELS[key];
  if(isImpactUnknown(option,key)){
    return{
      horizon:p.horizon,
      regret:`${p.horizon} 年后，若「${option.name}」在${label}上的实际影响偏负面，你可能遗憾没有更好照顾${label}；该维度目前尚未判断。`,
      trigger:`当${label}需求上升而实际结果不利时，后悔感可能升高。`,
      reversibility:option.reversibility>=60?'仍有较大调整空间':'改变成本可能随时间增加',
      action:`先补齐${label}维度的判断，再据此设定可检查的阶段目标。`,
      tentative:true,
      missingKey:key,
    };
  }
  return{
    horizon:p.horizon,
    regret:`${p.horizon} 年后，你可能遗憾「${option.name}」没有更好照顾${label}。`,
    trigger:`当${label}需求持续得不到满足，后悔感可能升高。`,
    reversibility:option.reversibility>=60?'仍有较大调整空间':'改变成本可能随时间增加',
    action:`现在就为${label}设一个可检查的阶段目标。`,
    tentative:false,
  };
}

export function safetyNoticesFor(text:string):string[]{
  const notices:string[]=[];
  if(/医疗|诊断|治疗|medical/i.test(text))notices.push('涉及医疗，请同时咨询合格医疗专业人士。');
  if(/法律|诉讼|合同|legal/i.test(text))notices.push('涉及法律，请同时咨询合格法律专业人士。');
  if(/投资|股票|理财|investment/i.test(text))notices.push('涉及投资，请评估承受能力并咨询持牌专业人士。');
  return notices;
}

export function analyzeDecision(draft:DecisionDraft):DecisionAnalysis{
  const weights=normalizeWeights(draft.weights);
  const options:OptionAnalysis[]=draft.options.map(option=>{
    const points=HORIZONS.map(h=>point(option,weights,h));
    const unknown=unknownKeysOf(option);
    const weighted=(p:RegretPoint[])=>Math.round(p[0].score*.3+p[1].score*.4+p[2].score*.3);
    const totalMin=Math.round(points[0].min*.3+points[1].min*.4+points[2].min*.3);
    const totalMax=Math.round(points[0].max*.3+points[1].max*.4+points[2].max*.3);
    return{
      option,
      points,
      cards:points.map(p=>card(option,p,weights)),
      total:weighted(points),
      minTotal:totalMin,
      maxTotal:totalMax,
      unknownKeys:unknown,
      completeness:Math.round((VALUE_KEYS.length-unknown.length)/VALUE_KEYS.length*100),
    };
  })
    // 临时排序按最坏情况（最大可能后悔）升序：未知越多，最坏分越高，不会因缺数据占便宜。
    .sort((a,b)=>a.maxTotal-b.maxTotal||a.minTotal-b.minTotal||a.total-b.total);

  const leader=options[0];
  const hasGaps=options.some(o=>o.unknownKeys.length>0);
  // 稳健性检验：领先者最坏情况仍比每个对手的最好情况好至少 5 分（沿用原“接近”阈值）。
  const robust=options.slice(1).every(o=>leader.maxTotal+CLOSENESS<=o.minTotal);
  // 稳健但分差小于 5：沿用原“非常接近”规则，不强推领先者。
  const closeKnown=!hasGaps&&!robust&&options.some((o,i)=>i>0&&o.minTotal-leader.minTotal<CLOSENESS);

  let status:DecisionAnalysis['status'];
  let recommendation:string;
  let winnerId:string|undefined;
  let blockingGaps:GapRef[]=[];

  if(closeKnown){
    const second=options[1];
    status='complete';
    recommendation=`「${leader.option.name}」与「${second.option.name}」非常接近，建议补充信息后再决定。`;
  }else if(robust){
    winnerId=leader.option.id;
    status=hasGaps?'robust-with-gaps':'complete';
    recommendation=hasGaps
      ?`目前看，「${leader.option.name}」是更不容易后悔的方向；即使把尚未判断的维度按最坏情况估计，它与其他选项仍有至少 ${CLOSENESS} 分差距，结论不受缺口影响。补齐判断后可再次复核。`
      :`目前看，「${leader.option.name}」是更不容易后悔的方向。`;
  }else{
    status='provisional';
    // 找出真正参与“区间重叠”的缺口：领先者自身的未知（可能让它变差）
    // 与可能反超的对手的未知（最好情况能逼近领先者最坏情况）。
    const contenders=options.slice(1).filter(o=>leader.maxTotal+CLOSENESS>o.minTotal);
    const involved=new Set<ValueKey>(leader.unknownKeys.filter(k=>weights[k]>0));
    contenders.forEach(o=>o.unknownKeys.forEach(k=>{if(weights[k]>0)involved.add(k)}));
    blockingGaps=options
      .map(o=>({optionId:o.option.id,optionName:o.option.name,keys:o.unknownKeys.filter(k=>involved.has(k))}))
      .filter(g=>g.keys.length>0);
    const gapText=blockingGaps.map(g=>`「${g.optionName}」的${g.keys.map(k=>VALUE_LABELS[k]).join('、')}`).join('；');
    recommendation=`信息不足，暂不给出确定建议。按“最坏情况”临时排序，「${leader.option.name}」暂时靠前，但 ${gapText||('「'+leader.option.name+'」与其他选项')} 尚未判断，区间结果相互重叠，补齐后重新计算才可能得到正式建议。未判断不等于中性 0 分，未知较多的方案不会因此排到前面。`;
  }

  return{options,recommendation,winnerId,status,blockingGaps,notices:safetyNoticesFor(`${draft.title} ${draft.background}`)};
}

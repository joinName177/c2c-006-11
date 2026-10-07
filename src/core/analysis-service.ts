import{normalizeWeights}from'./weight-service';
import{VALUE_KEYS,VALUE_LABELS,type DecisionAnalysis,type DecisionDraft,type Horizon,type ImpactGap,type OptionAnalysis,type RegretPoint,type RehearsalCard,type ValueKey}from'./models';

const timeFactor:Record<Horizon,Record<ValueKey,number>>={
  1:{stability:1.2,growth:.75,freedom:.8,money:1.15},
  5:{stability:1,growth:1,freedom:1,money:1},
  10:{stability:.8,growth:1.25,freedom:1.2,money:.85}
};
const HORIZONS=[1,5,10]as Horizon[];
const CLOSE_MARGIN=5;

/** 单个维度的后悔贡献（未取整，用于精确汇总） */
function contribution(impact:number,weight:number,horizon:Horizon,key:ValueKey){
  return(5-impact)/10*weight*timeFactor[horizon][key];
}

function point(option:DecisionDraft['options'][number],weights:ReturnType<typeof normalizeWeights>,relevant:ReadonlySet<ValueKey>,horizon:Horizon):RegretPoint{
  const breakdown={}as RegretPoint['breakdown'];
  const breakdownRange:NonNullable<RegretPoint['breakdownRange']>={};
  let known=0,best=0,worst=0;
  for(const key of VALUE_KEYS){
    const cell=option.impacts[key];
    if(cell.known){
      const value=contribution(cell.value,weights[key],horizon,key);
      breakdown[key]=Math.round(value*10)/10;
      known+=value;
    }else{
      // 未知维度不按 0 处理：按影响 +5（最好情形）与 -5（最差情形）给出明确区间
      const lo=contribution(5,weights[key],horizon,key);
      const hi=contribution(-5,weights[key],horizon,key);
      best+=lo;worst+=hi;
      breakdown[key]=Math.round(((lo+hi)/2)*10)/10;
      if(relevant.has(key))breakdownRange[key]=[Math.round(lo*10)/10,Math.round(hi*10)/10];
    }
  }
  const irreversible=(100-option.reversibility)*.08*(horizon/10);
  const clamp=(n:number)=>Math.max(0,Math.min(100,Math.round(n+irreversible)));
  return{horizon,score:clamp(known+(best+worst)/2),scoreBest:clamp(known+best),scoreWorst:clamp(known+worst),breakdown,breakdownRange};
}

function card(option:DecisionDraft['options'][number],p:RegretPoint,gapKeys:ValueKey[]):RehearsalCard{
  const knownKeys=VALUE_KEYS.filter(k=>option.impacts[k].known);
  const key=knownKeys.slice().sort((a,b)=>((5-option.impacts[b].value)-(5-option.impacts[a].value)))[0];
  if(!key)return{
    horizon:p.horizon,
    regret:`${p.horizon} 年后，「${option.name}」的后悔程度暂时无法具体描述：相关价值影响全部尚未判断。`,
    trigger:'缺少任何一个价值维度的判断，预演只能给出可能的指数区间。',
    reversibility:option.reversibility>=60?'仍有较大调整空间':'改变成本可能随时间增加',
    action:'先为至少一个价值维度补充影响判断，再生成预演。',
    gapNote:`缺口：${gapKeys.map(k=>VALUE_LABELS[k]).join('、')}尚未判断。`
  };
  const label=VALUE_LABELS[key];
  return{
    horizon:p.horizon,
    regret:`${p.horizon} 年后，你可能遗憾「${option.name}」没有更好照顾${label}。`,
    trigger:`当${label}需求持续得不到满足，后悔感可能升高。`,
    reversibility:option.reversibility>=60?'仍有较大调整空间':'改变成本可能随时间增加',
    action:`现在就为${label}设一个可检查的阶段目标。`,
    gapNote:gapKeys.length?`本卡基于已判断维度生成；${gapKeys.map(k=>VALUE_LABELS[k]).join('、')}尚未判断，实际后悔可能超出该描述。`:undefined
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
  const rawWeights=draft.weights;
  const weights=normalizeWeights(rawWeights);
  // 权重为零的维度不参与比较：该维度上的未知属于“无关缺口”，不阻止正式建议
  const relevant=new Set(VALUE_KEYS.filter(k=>Math.max(0,rawWeights[k])>0));
  const allGaps:ImpactGap[]=[];
  const knownCellsAll:number[]=[];
  const relevantCellsAll:number[]=[];

  const options:OptionAnalysis[]=draft.options.map(option=>{
    const relevantGapKeys=VALUE_KEYS.filter(k=>!option.impacts[k].known&&relevant.has(k));
    const irrelevantGapKeys=VALUE_KEYS.filter(k=>!option.impacts[k].known&&!relevant.has(k));
    relevantGapKeys.forEach(k=>allGaps.push({optionId:option.id,optionName:option.name,key:k,relevant:true}));
    irrelevantGapKeys.forEach(k=>allGaps.push({optionId:option.id,optionName:option.name,key:k,relevant:false}));
    const points=HORIZONS.map(h=>point(option,weights,relevant,h));
    const total=points[0].score*.3+points[1].score*.4+points[2].score*.3;
    const totalBest=(points[0].scoreBest??points[0].score)*.3+(points[1].scoreBest??points[1].score)*.4+(points[2].scoreBest??points[2].score)*.3;
    const totalWorst=(points[0].scoreWorst??points[0].score)*.3+(points[1].scoreWorst??points[1].score)*.4+(points[2].scoreWorst??points[2].score)*.3;
    knownCellsAll.push(VALUE_KEYS.filter(k=>option.impacts[k].known).length);
    relevantCellsAll.push(VALUE_KEYS.filter(k=>relevant.has(k)&&option.impacts[k].known).length);
    return{
      option,points,
      cards:points.map(p=>card(option,p,relevantGapKeys)),
      total:Math.round(total),
      totalBest:Math.round(totalBest*10)/10,
      totalWorst:Math.round(totalWorst*10)/10,
      knownCells:VALUE_KEYS.filter(k=>option.impacts[k].known).length,
      relevantCells:VALUE_KEYS.filter(k=>relevant.has(k)&&option.impacts[k].known).length,
      relevantGapKeys,
      irrelevantGapKeys
    };
  });

  const relevantGapCount=allGaps.filter(g=>g.relevant).length;
  const irrelevantGapCount=allGaps.length-relevantGapCount;
  const relevantTotal=relevant.size*draft.options.length;

  let recommendation:string;let recommendationStatus:DecisionAnalysis['recommendationStatus'];let winnerId:string|undefined;
  let sorted:OptionAnalysis[];

  if(relevantGapCount===0){
    // 全部相关影响都已判断：沿用确定规则（未知只可能存在于零权重维度，不影响比较）
    sorted=options.slice().sort((a,b)=>a.total-b.total);
    const close=(sorted[1]?.total??Infinity)-sorted[0].total<CLOSE_MARGIN;
    recommendation=close
      ?`「${sorted[0].option.name}」与「${sorted[1].option.name}」非常接近，建议补充信息后再决定。`
      :`目前看，「${sorted[0].option.name}」是更不容易后悔的方向。`;
    recommendationStatus='definitive';
    winnerId=close?undefined:sorted[0].option.id;
  }else{
    // 存在相关缺口：区间分析。按最不利情形（最差边界）保守排序——
    // 未知多的方案区间更宽、最差边界更差，不会因为“没有负面数据”而占优。
    sorted=options.slice().sort((a,b)=>(a.totalWorst??a.total)-(b.totalWorst??b.total));
    const leader=sorted[0];
    const dominates=sorted.slice(1).every(o=>(leader.totalWorst??leader.total)<=(o.totalBest??o.total)-CLOSE_MARGIN);
    if(dominates){
      recommendation=`即使「${leader.option.name}」尚未判断的影响全部取最差情形，它仍至少领先 5 分：可条件性地优先考虑它；补齐缺口后请重新推演确认。`;
      recommendationStatus='robust';
      winnerId=leader.option.id;
    }else{
      recommendation=`还有 ${relevantGapCount} 项与权重相关的影响尚未判断，可能改变方案排名，暂不给出正式建议。下方区间结果仅供临时分析，补齐后重新推演即可。`;
      recommendationStatus='inconclusive';
      winnerId=undefined;
    }
  }

  const assumptions:string[]=[];
  if(relevantGapCount>0)assumptions.push(
    '临时区间规则：每项尚未判断的影响，最好情形按 +5、最差情形按 -5 计入（绝不按 0 中性处理，也不自动忽略）。',
    '排序采用各方案的“最差情形后悔指数”，避免信息缺口多的方案因缺少负面数据而排在前面。'
  );
  if(irrelevantGapCount>0)assumptions.push(`${irrelevantGapCount} 项未判断影响位于权重为 0 的维度，不参与本次比较，但仍保留为缺口。`);

  return{
    options:sorted,
    recommendation,
    recommendationStatus,
    winnerId,
    notices:safetyNoticesFor(`${draft.title} ${draft.background}`),
    gaps:allGaps,
    relevantGapCount,
    irrelevantGapCount,
    knownCells:knownCellsAll.reduce((a,b)=>a+b,0),
    relevantCells:relevantCellsAll.reduce((a,b)=>a+b,0),
    assumptions,
    generatedAt:new Date().toISOString()
  };
}

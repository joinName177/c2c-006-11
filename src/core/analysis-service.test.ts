import{describe,it,expect}from'vitest';
import{analyzeDecision}from'./analysis-service';
import{migrateDraft,type DecisionDraft,type ValueKey,type ValueWeights}from'./models';
import{createSampleDraft}from'./sample-data';

const weights:ValueWeights={stability:30,growth:35,freedom:20,money:15};

function draft(options:DecisionDraft['options']):DecisionDraft{
  return{id:'t',title:'测试决策',background:'',options,weights,updatedAt:'2026-10-07T00:00:00Z'};
}
function opt(id:string,name:string,impacts:Partial<Record<ValueKey,number>>,unknown:ValueKey[]=[],reversibility=70){
  return{id,name,description:'',impacts:{stability:0,growth:0,freedom:0,money:0,...impacts},reversibility,unknownImpacts:unknown};
}

describe('analyzeDecision · 未判断影响',()=>{
  it('未判断维度产生区间，且区间反映影响 -5..+5 的全部可能，不当作 0',()=>{
    const a=analyzeDecision(draft([opt('a','甲',{},[],100),opt('b','乙',{},[...(['stability','growth','freedom','money']as ValueKey[])],100)]));
    const known=a.options.find(o=>o.option.id==='a')!;
    const unk=a.options.find(o=>o.option.id==='b')!;
    expect(known.minTotal).toBe(known.maxTotal); // 全已知：确定分数
    expect(unk.minTotal).toBeLessThan(unk.maxTotal); // 未知：有非平凡区间
    expect(unk.minTotal).toBe(0); // 最坏/最好：全未知且可逆 100 附近 → 最好可能 0
    // 排序按最坏情况：未知方案即使“最好情况为 0”也不能排在确定为中性的方案前面
    expect(a.options.map(o=>o.option.id)).toEqual(['a','b']);
    expect(a.status).toBe('provisional');
    expect(a.winnerId).toBeUndefined();
    expect(a.blockingGaps.length).toBeGreaterThan(0);
  });

  it('缺口不影响比较时仍给正式建议，并标记 robust-with-gaps 与稳健领先',()=>{
    // 金钱权重 15% 但有未知；对手其余三维均为 -5，最好情况也远差于领先者
    const a=analyzeDecision(draft([
      opt('good','好方案',{stability:5,growth:5,freedom:5,money:5},[],90),
      opt('bad','差方案',{stability:-5,growth:-5,freedom:-5},['money'],55),
    ]));
    expect(a.status).toBe('robust-with-gaps');
    expect(a.winnerId).toBe('good');
    expect(a.options[0].option.id).toBe('good');
  });

  it('全部已知时状态为 complete',()=>{
    const a=analyzeDecision(draft([opt('a','甲',{stability:5},[]),opt('b','乙',{stability:-5},[])]));
    expect(a.status).toBe('complete');
    expect(a.winnerId).toBe('a');
    a.options.forEach(o=>expect(o.minTotal).toBe(o.maxTotal));
  });

  it('权重为 0 的维度未知不阻止结论（缺口对比较无作用）',()=>{
    const w0:ValueWeights={stability:50,growth:50,freedom:0,money:0};
    const d=draft([opt('a','甲',{stability:5,growth:5},['freedom','money']),opt('b','乙',{stability:-5,growth:-5},['freedom','money'])]);
    d.weights=w0;
    const a=analyzeDecision(d);
    expect(a.winnerId).toBe('a');
    expect(a.status).toBe('robust-with-gaps');
  });

  it('条件性预演卡标注 tentative，已知方案卡片为确定',()=>{
    const a=analyzeDecision(draft([opt('a','甲',{},[]),opt('b','乙',{},['stability','growth','freedom','money'])]));
    expect(a.options.find(o=>o.option.id==='a')!.cards.every(c=>!c.tentative)).toBe(true);
    expect(a.options.find(o=>o.option.id==='b')!.cards.every(c=>c.tentative)).toBe(true);
  });

  it('全部已知且前两名接近时仍为 complete（沿用原“接近不强推”规则，不与缺口混淆）',()=>{
    const a=analyzeDecision(createSampleDraft());
    expect(a.status).toBe('complete');
    expect(a.winnerId).toBeUndefined();
    expect(a.blockingGaps).toEqual([]);
    expect(a.recommendation).toContain('非常接近');
  });

  it('未知较多的方案不会因“缺少负面数据”排在前面（按最坏情况排序）',()=>{
    // 甲：确定偏好（稳定 +3，其余中性）；乙：已知维度偏好类似，但自由维度未知——
    // 若把未知偷偷当 0，乙会以“无负面数据”胜出；按区间它的最好/最坏跨越甲的分数。
    const a=analyzeDecision(draft([
      opt('steady','稳妥',{stability:3,growth:0,freedom:0,money:0},[],70),
      opt('mystery','神秘',{stability:3,growth:0,money:0},['freedom'],70),
    ]));
    expect(a.status).toBe('provisional');
    expect(a.winnerId).toBeUndefined();
    const steady=a.options.find(o=>o.option.id==='steady')!;
    const mystery=a.options.find(o=>o.option.id==='mystery')!;
    // 最坏情况排序下两者并列（乙最坏 = 甲确定分），乙无法靠缺数据抢占单独第一
    expect(mystery.maxTotal).toBeGreaterThan(mystery.minTotal);
    expect(mystery.maxTotal).toBeGreaterThanOrEqual(steady.total);
    expect(a.blockingGaps.some(g=>g.optionId==='mystery'&&g.keys.includes('freedom'))).toBe(true);
  });

  it('完整度比例正确',()=>{
    const a=analyzeDecision(draft([opt('a','甲',{},['money']),opt('b','乙',{},['stability','growth'])]));
    expect(a.options.find(o=>o.option.id==='a')!.completeness).toBe(75);
    expect(a.options.find(o=>o.option.id==='b')!.completeness).toBe(50);
  });
});

describe('旧案例迁移',()=>{
  it('缺少 unknownImpacts 的旧数据：0 仍代表中性，分数与确定输入一致',()=>{
    const legacy={id:'old',title:'旧案例',background:'',weights,updatedAt:'',options:[
      {id:'a',name:'甲',description:'',impacts:{stability:0,growth:0,freedom:0,money:0},reversibility:70},
      {id:'b',name:'乙',description:'',impacts:{stability:-2,growth:3,freedom:1,money:0},reversibility:60},
    ]} as unknown as DecisionDraft;
    const migrated=migrateDraft(legacy);
    migrated.options.forEach(o=>expect(o.unknownImpacts).toEqual([]));
    const a=analyzeDecision(migrated);
    expect(a.status).toBe('complete');
    a.options.forEach(o=>{expect(o.minTotal).toBe(o.maxTotal);expect(o.minTotal).toBe(o.total)});
  });
});

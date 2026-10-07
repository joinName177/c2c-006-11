import{describe,it,expect}from'vitest';
import{analyzeDecision}from'./analysis-service';
import{knownImpacts,unknownImpacts,type DecisionDraft}from'./models';

const weights={stability:25,growth:25,freedom:25,money:25};
function draftOf(options:DecisionDraft['options']):DecisionDraft{
  return{id:'d',title:'测试决策',background:'',weights,updatedAt:'2026-10-07T00:00:00Z',options};
}
const opt=(id:string,name:string,impacts:DecisionDraft['options'][number]['impacts'],reversibility=70)=>({id,name,description:'',impacts,reversibility});

describe('analyzeDecision · 完整判断',()=>{
  it('全部已知时给出确定建议',()=>{
    const analysis=analyzeDecision(draftOf([
      opt('a','甲',knownImpacts({stability:4,growth:4,freedom:4,money:4})),
      opt('b','乙',knownImpacts({stability:-4,growth:-4,freedom:-4,money:-4}))
    ]));
    expect(analysis.recommendationStatus).toBe('definitive');
    expect(analysis.winnerId).toBe('a');
    expect(analysis.relevantGapCount).toBe(0);
    expect(analysis.options[0].totalBest).toBe(analysis.options[0].totalWorst);
  });
  it('差距小于 5 时不强推',()=>{
    const analysis=analyzeDecision(draftOf([
      opt('a','甲',knownImpacts({stability:0,growth:0,freedom:0,money:0}),50),
      opt('b','乙',knownImpacts({stability:0,growth:0,freedom:0,money:0}),50)
    ]));
    expect(analysis.winnerId).toBeUndefined();
  });
});

describe('analyzeDecision · 未知影响',()=>{
  it('未知不被当作 0：含未知的方案产生更宽的区间',()=>{
    const analysis=analyzeDecision(draftOf([
      opt('a','甲',unknownImpacts()),
      opt('b','乙',knownImpacts({stability:0,growth:0,freedom:0,money:0}))
    ]));
    const a=analysis.options.find(o=>o.option.id==='a')!;
    const b=analysis.options.find(o=>o.option.id==='b')!;
    expect(a.totalBest!).toBeLessThan(a.totalWorst!);
    expect(b.totalBest).toBe(b.totalWorst);
    // 未知区间对称覆盖 0 的贡献：a 的中值与 b 相同，但区间向更差延伸
    expect(a.totalWorst!).toBeGreaterThan(b.totalWorst!);
  });

  it('未知多的方案不会仅因缺少负面数据排在前面：全部未知时不给正式建议',()=>{
    const analysis=analyzeDecision(draftOf([
      opt('a','甲',unknownImpacts()),
      opt('b','乙',unknownImpacts())
    ]));
    expect(analysis.recommendationStatus).toBe('inconclusive');
    expect(analysis.winnerId).toBeUndefined();
    expect(analysis.recommendation).toContain('尚未判断');
    expect(analysis.assumptions.length).toBeGreaterThan(0);
    expect(analysis.gaps).toHaveLength(8);
  });

  it('领先方案在最不利情形仍领先时给条件性（robust）建议',()=>{
    // 强方案全部已知且很好；对手三个维度未知（最好按 +5）、一个维度极差，
    // 其最好情形仍落后超过 5 分 → 可以给条件性建议
    const vagueImpacts=knownImpacts({stability:-5,growth:-5,freedom:-5,money:-5});
    vagueImpacts.growth={value:0,known:false};
    vagueImpacts.freedom={value:0,known:false};
    vagueImpacts.money={value:0,known:false};
    const analysis=analyzeDecision(draftOf([
      opt('good','好方案',knownImpacts({stability:5,growth:5,freedom:5,money:5}),90),
      opt('vague','未知方案',vagueImpacts,90)
    ]));
    expect(analysis.relevantGapCount).toBe(3);
    expect(analysis.recommendationStatus).toBe('robust');
    expect(analysis.winnerId).toBe('good');
  });

  it('未知方案最好情形可能反超时阻止正式建议（不能把缺口当优势）',()=>{
    // 已知的好方案 vs 全部未知方案：未知者最好按 +5 时反超 → inconclusive
    const analysis=analyzeDecision(draftOf([
      opt('good','好方案',knownImpacts({stability:3,growth:3,freedom:3,money:3}),70),
      opt('vague','未知方案',unknownImpacts(),70)
    ]));
    expect(analysis.recommendationStatus).toBe('inconclusive');
    expect(analysis.winnerId).toBeUndefined();
  });

  it('零权重维度上的未知不阻止正式建议',()=>{
    const d=draftOf([
      opt('a','甲',(()=>{const i=knownImpacts({stability:4,growth:4,freedom:4,money:4});i.money={value:0,known:false};return i})()),
      opt('b','乙',(()=>{const i=knownImpacts({stability:-4,growth:-4,freedom:-4,money:-4});i.money={value:0,known:false};return i})())
    ]);
    d.weights={stability:50,growth:50,freedom:0,money:0};
    const analysis=analyzeDecision(d);
    expect(analysis.relevantGapCount).toBe(0);
    expect(analysis.irrelevantGapCount).toBeGreaterThan(0);
    expect(analysis.recommendationStatus).toBe('definitive');
    expect(analysis.winnerId).toBe('a');
  });

  it('区间端点按 +5 / -5 假设且截断在 0–100',()=>{
    const analysis=analyzeDecision(draftOf([
      opt('a','甲',unknownImpacts(),0),
      opt('b','乙',knownImpacts({stability:0,growth:0,freedom:0,money:0}),0)
    ]));
    const a=analysis.options.find(o=>o.option.id==='a')!;
    for(const p of a.points){
      expect(p.scoreBest!).toBeGreaterThanOrEqual(0);
      expect(p.scoreWorst!).toBeLessThanOrEqual(100);
      expect(p.scoreBest!).toBeLessThanOrEqual(p.scoreWorst!);
    }
  });

  it('结果可追溯：缺口列出具体方案与维度，补齐后重算为确定结果',()=>{
    const first=analyzeDecision(draftOf([
      opt('a','甲',unknownImpacts()),
      opt('b','乙',knownImpacts({stability:0,growth:0,freedom:0,money:0}))
    ]));
    expect(first.gaps.map(g=>`${g.optionId}:${g.key}`)).toContain('a:stability');
    // 补齐缺口
    const again=analyzeDecision(draftOf([
      opt('a','甲',knownImpacts({stability:0,growth:0,freedom:0,money:0})),
      opt('b','乙',knownImpacts({stability:0,growth:0,freedom:0,money:0}))
    ]));
    expect(again.gaps).toHaveLength(0);
    expect(again.recommendationStatus).toBe('definitive');
  });
});

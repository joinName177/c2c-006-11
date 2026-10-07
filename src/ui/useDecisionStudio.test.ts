import{describe,it,expect,beforeEach}from'vitest';
import{LocalCaseRepository}from'../adapters/local-case.repository';
import{useDecisionStudio}from'./useDecisionStudio';
import{VALUE_KEYS,type SavedCase}from'../core/models';

function studio(){
  return useDecisionStudio(new LocalCaseRepository(localStorage),{print(){}});
}

beforeEach(()=>localStorage.clear());

describe('useDecisionStudio · 未判断状态流转',()=>{
  it('新增方案的维度默认“未判断”，而不是 0；分析给条件性结果而非确定推荐',()=>{
    const s=studio();
    s.addOption();
    const added=s.draft.options.find(o=>o.name==='新选项')!;
    expect([...(added.unknownImpacts??[])].sort()).toEqual([...VALUE_KEYS].sort());
    s.analyze();
    expect(s.errors.value).toEqual([]);
    expect(s.analysis.value!.status).toBe('provisional');
    expect(s.analysis.value!.winnerId).toBeUndefined();
  });

  it('未知/已知切换保留用户之前的输入，且不重置为 0',()=>{
    const s=studio();
    s.addOption();
    const o=s.draft.options.find(x=>x.name==='新选项')!;
    s.setImpact(o.id,'growth',4);
    expect(o.impacts.growth).toBe(4);
    expect(o.unknownImpacts).not.toContain('growth');
    s.setImpactUnknown(o.id,'growth',true);
    expect(o.unknownImpacts).toContain('growth');
    expect(o.impacts.growth).toBe(4); // 暂存值保留
    s.setImpactUnknown(o.id,'growth',false);
    expect(o.unknownImpacts).not.toContain('growth');
    expect(o.impacts.growth).toBe(4); // 恢复的是用户输入，不是 0
  });

  it('补齐缺口重新计算后，所有方案区间收敛为确定分数',()=>{
    const s=studio();
    s.addOption();
    s.analyze();
    expect(s.analysis.value!.status).toBe('provisional');
    const o=s.draft.options.find(x=>x.name==='新选项')!;
    VALUE_KEYS.forEach((k,i)=>s.setImpact(o.id,k,i-2));
    s.analyze();
    expect(s.analysis.value!.blockingGaps).toEqual([]);
    s.analysis.value!.options.forEach(item=>{
      expect(item.unknownKeys).toEqual([]);
      expect(item.minTotal).toBe(item.maxTotal);
    });
  });

  it('保存后重新打开，未知标记、暂存输入和完整度分析一致',()=>{
    const s=studio();
    s.addOption();
    const o=s.draft.options.find(x=>x.name==='新选项')!;
    s.setImpact(o.id,'growth',3);
    s.setImpact(o.id,'money',-1);
    s.analyze();
    s.save();
    const s2=studio();
    const loaded=s2.cases.value.find(c=>c.draft.id===s.draft.id)!;
    s2.load(loaded);
    const restored=s2.draft.options.find(x=>x.id===o.id)!;
    expect(restored.unknownImpacts?.sort()).toEqual(['freedom','stability']);
    expect(restored.impacts.growth).toBe(3);
    expect(restored.impacts.money).toBe(-1);
    expect(s2.analysis.value?.status).toBe('provisional');
    expect(s2.analysis.value?.options.find(x=>x.option.id===o.id)?.completeness).toBe(50);
  });

  it('旧案例（无 unknownImpacts、旧版 analysis）重新打开：0 仍是中性，自动重算为 complete 且分数不变',()=>{
    const repo=new LocalCaseRepository(localStorage);
    const legacyDraft={id:'legacy',title:'旧',background:'',updatedAt:'2026-09-01',weights:{stability:30,growth:35,freedom:20,money:15},options:[
      {id:'a',name:'甲',description:'',impacts:{stability:0,growth:0,freedom:0,money:0},reversibility:70},
      {id:'b',name:'乙',description:'',impacts:{stability:-2,growth:3,freedom:1,money:0},reversibility:60},
    ]};
    const legacy:SavedCase={draft:legacyDraft as never,analysis:{options:[],recommendation:'旧建议'}} as unknown as SavedCase;
    repo.save(legacy);
    const s=studio();
    expect(s.cases.value).toHaveLength(1);
    s.load(s.cases.value[0]);
    s.draft.options.forEach(o=>expect(o.unknownImpacts).toEqual([]));
    expect(s.analysis.value?.status).toBe('complete');
    s.analysis.value!.options.forEach(o=>expect(o.minTotal).toBe(o.maxTotal));
  });
});

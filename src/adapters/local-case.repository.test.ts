import{describe,it,expect,beforeEach}from'vitest';
import{LocalCaseRepository}from'./local-case.repository';
import{unknownImpacts,knownImpacts,type SavedCase,type LegacySavedCase}from'../core/models';

class MemoryStorage{
  private map=new Map<string,string>();
  getItem(k:string){return this.map.get(k)??null}
  setItem(k:string,v:string){this.map.set(k,v)}
  removeItem(k:string){this.map.delete(k)}
  clear(){this.map.clear()}
  get length(){return this.map.size}
  key(){return null}
}

describe('LocalCaseRepository · 未知/中性的持久化与旧案例迁移',()=>{
  let storage:MemoryStorage;
  beforeEach(()=>{storage=new MemoryStorage()});

  it('保存含“尚未判断”的案例，重新打开后仍是未知；已知 0 仍是中性',()=>{
    const repo=new LocalCaseRepository(storage as unknown as Storage);
    const saved:SavedCase={
      version:2,
      draft:{id:'c1',title:'T',background:'',weights:{stability:25,growth:25,freedom:25,money:25},updatedAt:'',options:[
        {id:'a',name:'甲',description:'',impacts:unknownImpacts(),reversibility:60},
        {id:'b',name:'乙',description:'',impacts:knownImpacts({stability:0,growth:0,freedom:0,money:0}),reversibility:60}
      ]}
    };
    repo.save(saved);
    const reopened=new LocalCaseRepository(storage as unknown as Storage).list();
    expect(reopened[0].draft.options[0].impacts.stability).toEqual({value:0,known:false});
    expect(reopened[0].draft.options[1].impacts.stability).toEqual({value:0,known:true});
  });

  it('旧存储（数字影响）读取时自动迁移：数字 0 → 已知中性，并丢弃旧分析',()=>{
    const legacy:LegacySavedCase={
      draft:{id:'old',title:'旧',background:'',weights:{stability:25,growth:25,freedom:25,money:25},updatedAt:'',options:[
        {id:'a',name:'甲',description:'',impacts:{stability:0,growth:0,freedom:0,money:0},reversibility:50}
      ]},
      analysis:{winnerId:'a'}
    };
    storage.setItem('c2c-006.cases.v1',JSON.stringify([legacy]));
    const repo=new LocalCaseRepository(storage as unknown as Storage);
    const list=repo.list();
    expect(list[0].version).toBe(2);
    expect(list[0].draft.options[0].impacts.growth).toEqual({value:0,known:true});
    expect(list[0].analysis).toBeUndefined();
    // 迁移结果已写回，再读一次不会重复迁移
    expect(new LocalCaseRepository(storage as unknown as Storage).list()[0].draft.options[0].impacts.growth).toEqual({value:0,known:true});
  });
});

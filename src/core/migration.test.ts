import{describe,it,expect}from'vitest';
import{migrateCase,isLegacyCase}from'./migration';
import{knownImpacts,unknownImpacts,type LegacySavedCase,type SavedCase}from'./models';
const legacyCase:LegacySavedCase={
  draft:{
    id:'old',title:'旧案例',background:'',
    weights:{stability:25,growth:25,freedom:25,money:25},updatedAt:'2026-01-01T00:00:00Z',
    options:[
      {id:'a',name:'甲',description:'',impacts:{stability:0,growth:0,freedom:0,money:0},reversibility:50},
      {id:'b',name:'乙',description:'',impacts:{stability:3,growth:-2,freedom:1,money:0},reversibility:50}
    ]
  },
  analysis:{some:'old analysis shape'}
};

describe('legacy migration',()=>{
  it('识别旧版数字影响',()=>{
    expect(isLegacyCase(legacyCase)).toBe(true);
    expect(isLegacyCase({draft:{options:[{impacts:unknownImpacts()}]}} as unknown as SavedCase)).toBe(false);
  });
  it('旧案例的数字一律迁移为“已判断”，0 仍代表中性而非未知',()=>{
    const migrated=migrateCase(legacyCase);
    expect(migrated.version).toBe(2);
    for(const k of['stability','growth','freedom','money'] as const){
      expect(migrated.draft.options[0].impacts[k]).toEqual({value:0,known:true});
      expect(migrated.draft.options[1].impacts[k].known).toBe(true);
    }
  });
  it('迁移后丢弃无法兼容的旧分析，要求重新推演',()=>{
    expect(migrateCase(legacyCase).analysis).toBeUndefined();
  });
  it('已经是 v2 的案例原样返回',()=>{
    const v2=migrateCase(legacyCase);
    expect(migrateCase(v2)).toBe(v2);
  });
  it('新格式中的中性 0 与未知可区分',()=>{
    expect(knownImpacts({stability:0,growth:0,freedom:0,money:0}).stability).toEqual({value:0,known:true});
    expect(unknownImpacts().stability).toEqual({value:0,known:false});
  });
});

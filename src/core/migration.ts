import{VALUE_KEYS,type DecisionDraft,type ImpactCell,type LegacySavedCase,type SavedCase,knownImpacts}from'./models';

/** 判断存储中的方案是否是旧版本（影响为数字而非 ImpactCell） */
export function isLegacyCase(value:unknown):value is LegacySavedCase{
  const draft=(value as{ draft?:LegacySavedCase['draft'] })?.draft;
  const impacts=draft?.options?.[0]?.impacts as Record<string,unknown>|undefined;
  return Boolean(impacts&&VALUE_KEYS.some(k=>typeof impacts[k]==='number'));
}

/**
 * 迁移旧案例：旧的影响数字一律视为“已判断”——0 仍代表原来的中性。
 * 旧分析基于“未知=0”之外的旧数字模型，评分本身可复现，但缺少缺口信息，
 * 因此迁移后丢弃旧分析，由用户重新推演（draft 完整时结果与原来一致）。
 */
export function migrateCase(value:unknown):SavedCase{
  if(!isLegacyCase(value))return value as SavedCase;
  const draft:DecisionDraft={
    ...value.draft,
    options:value.draft.options.map(o=>({...o,impacts:knownImpacts({...o.impacts})}))
  };
  return{version:2,draft};
}

export function migrateCases(values:unknown[]):SavedCase[]{
  return values.filter(Boolean).map(v=>migrateCase(v));
}

/** 供测试与适配器复用：把单个单元格断言为 ImpactCell */
export function asCell(value:ImpactCell|number|undefined):ImpactCell{
  if(value&&typeof value==='object'&&'known'in value)return value;
  return{value:typeof value==='number'?value:0,known:typeof value==='number'};
}

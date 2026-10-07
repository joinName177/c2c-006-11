export const VALUE_KEYS=['stability','growth','freedom','money'] as const;
export type ValueKey=typeof VALUE_KEYS[number];
export type ValueWeights=Record<ValueKey,number>;
// impacts 始终保存“最近一次输入的数值”（含明确中性 0）；
// unknownImpacts 中的维度表示该数值“尚未判断”，不参与评分，但在切回已知时原样恢复。
export interface DecisionOption{id:string;name:string;description:string;impacts:ValueWeights;reversibility:number;unknownImpacts?:ValueKey[]}
export interface DecisionDraft{id:string;title:string;background:string;options:DecisionOption[];weights:ValueWeights;updatedAt:string}
export type Horizon=1|5|10;
export interface RegretPoint{horizon:Horizon;score:number;min:number;max:number;breakdown:ValueWeights;unknownKeys:ValueKey[]}
export interface RehearsalCard{horizon:Horizon;regret:string;trigger:string;reversibility:string;action:string;tentative:boolean;missingKey?:ValueKey}
export type AnalysisStatus='complete'|'robust-with-gaps'|'provisional';
export interface OptionAnalysis{option:DecisionOption;points:RegretPoint[];cards:RehearsalCard[];total:number;minTotal:number;maxTotal:number;unknownKeys:ValueKey[];completeness:number}
export interface GapRef{optionId:string;optionName:string;keys:ValueKey[]}
export interface DecisionAnalysis{options:OptionAnalysis[];recommendation:string;winnerId?:string;status:AnalysisStatus;blockingGaps:GapRef[];notices:string[]}
export interface SavedCase{draft:DecisionDraft;analysis?:DecisionAnalysis}
export const VALUE_LABELS:Record<ValueKey,string>={stability:'稳定',growth:'成长',freedom:'自由',money:'金钱'};
// 旧案例没有 unknownImpacts 字段：其中的 0 代表原来的明确中性，迁移为“全部已知”。
export function unknownKeysOf(option:DecisionOption):ValueKey[]{return option.unknownImpacts??[]}
export function isImpactUnknown(option:DecisionOption,key:ValueKey):boolean{return unknownKeysOf(option).includes(key)}
export function withUnknownKeys(option:DecisionOption,keys:ValueKey[]):DecisionOption{const next=new Set(keys);return{...option,unknownImpacts:VALUE_KEYS.filter(k=>next.has(k))}}
export function migrateOption(option:DecisionOption):DecisionOption{return{...option,impacts:{...option.impacts},unknownImpacts:option.unknownImpacts?option.unknownImpacts.filter(k=>VALUE_KEYS.includes(k)):[]}}
export function migrateDraft(draft:DecisionDraft):DecisionDraft{return{...draft,weights:{...draft.weights},options:draft.options.map(o=>migrateOption(o))}}

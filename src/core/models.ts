export const VALUE_KEYS=['stability','growth','freedom','money'] as const;
export type ValueKey=typeof VALUE_KEYS[number];
export type ValueWeights=Record<ValueKey,number>;
/**
 * 单个价值维度的影响判断。
 * - known=true：用户已经判断，value ∈ [-5,5]；value=0 表示明确的“中性”。
 * - known=false：尚未判断；value 保留用户上一次输入（可能是初始 0），
 *   仅用于切回“已判断”时恢复，绝不参与评分。
 */
export interface ImpactCell{value:number;known:boolean}
export type ImpactSet=Record<ValueKey,ImpactCell>;
export interface DecisionOption{id:string;name:string;description:string;impacts:ImpactSet;reversibility:number}
export interface DecisionDraft{id:string;title:string;background:string;options:DecisionOption[];weights:ValueWeights;updatedAt:string}
export type Horizon=1|5|10;
/** 每个维度的后悔贡献；存在未知影响时以 [最好情形, 最差情形] 区间给出 */
export interface RegretPoint{horizon:Horizon;score:number;scoreBest?:number;scoreWorst?:number;breakdown:Record<ValueKey,number>;breakdownRange?:Partial<Record<ValueKey,[number,number]>>}
export interface RehearsalCard{horizon:Horizon;regret:string;trigger:string;reversibility:string;action:string;gapNote?:string}
/** 一条尚未判断的影响（可追溯的缺口） */
export interface ImpactGap{optionId:string;optionName:string;key:ValueKey;relevant:boolean}
export interface OptionAnalysis{option:DecisionOption;points:RegretPoint[];cards:RehearsalCard[];total:number;totalBest?:number;totalWorst?:number;knownCells:number;relevantCells:number;relevantGapKeys:ValueKey[];irrelevantGapKeys:ValueKey[]}
/**
 * definitive：所有与比较相关的影响都已判断，给出确定建议。
 * robust：存在相关缺口，但领先方案在最不利情形下仍领先（条件性建议）。
 * inconclusive：存在相关缺口且可能改变排名，阻止正式建议。
 */
export type RecommendationStatus='definitive'|'robust'|'inconclusive';
export interface DecisionAnalysis{options:OptionAnalysis[];recommendation:string;recommendationStatus:RecommendationStatus;winnerId?:string;notices:string[];gaps:ImpactGap[];relevantGapCount:number;irrelevantGapCount:number;knownCells:number;relevantCells:number;assumptions:string[];generatedAt:string}
export interface SavedCase{version?:2;draft:DecisionDraft;analysis?:DecisionAnalysis}
/** 旧版本存储形态：影响直接是数字（0 代表中性，没有“尚未判断”概念） */
export interface LegacyImpactSet extends Record<ValueKey,number>{}
export interface LegacyOption{id:string;name:string;description:string;impacts:LegacyImpactSet;reversibility:number}
export interface LegacyDraft{id:string;title:string;background:string;options:LegacyOption[];weights:ValueWeights;updatedAt:string}
export interface LegacySavedCase{draft:LegacyDraft;analysis?:unknown}
export const VALUE_LABELS:Record<ValueKey,string>={stability:'稳定',growth:'成长',freedom:'自由',money:'金钱'};
export function impactCell(value=0,known=false):ImpactCell{return{value,known}}
export function unknownImpacts():ImpactSet{return{stability:impactCell(),growth:impactCell(),freedom:impactCell(),money:impactCell()}}
export function knownImpacts(impacts:ValueWeights):ImpactSet{return{stability:impactCell(impacts.stability,true),growth:impactCell(impacts.growth,true),freedom:impactCell(impacts.freedom,true),money:impactCell(impacts.money,true)}}

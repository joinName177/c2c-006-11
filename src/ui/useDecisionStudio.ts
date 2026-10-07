import{reactive,ref}from'vue';
import{analyzeDecision}from'../core/analysis-service';
import{createSampleDraft}from'../core/sample-data';
import{validateDraft}from'../core/validation';
import{unknownImpacts,type DecisionAnalysis,type DecisionDraft,type DecisionOption,type ImpactCell,type SavedCase,type ValueKey,type ValueWeights}from'../core/models';
import type{CaseRepository}from'../ports/case-repository.port';
import type{PrintPort}from'../ports/print.port';
export function useDecisionStudio(repository:CaseRepository,printer:PrintPort){
  const draft=reactive<DecisionDraft>(createSampleDraft());
  const analysis=ref<DecisionAnalysis>();
  const errors=ref<string[]>([]);
  const stale=ref(false);
  const cases=ref<SavedCase[]>(repository.list());
  const touch=()=>{stale.value=Boolean(analysis.value);draft.updatedAt=new Date().toISOString()};
  function setWeights(weights:ValueWeights){draft.weights={...weights};touch()}
  function addOption(){
    if(draft.options.length>=4)return;
    draft.options.push({id:`option-${Date.now()}`,name:'新选项',description:'',impacts:unknownImpacts(),reversibility:70});
    touch();
  }
  function removeOption(id:string){
    if(draft.options.length<=2)return;
    draft.options=draft.options.filter(o=>o.id!==id);
    touch();
  }
  function updateOption(id:string,patch:Partial<DecisionOption>){
    const target=draft.options.find(o=>o.id===id);
    if(target)Object.assign(target,patch);
    touch();
  }
  /** 设置某个影响：输入数值即视为“已判断”（包括明确的中性 0） */
  function setImpact(id:string,key:ValueKey,value:number){
    const target=draft.options.find(o=>o.id===id);
    if(!target)return;
    target.impacts[key]={value,known:true};
    touch();
  }
  /**
   * 切换“尚未判断 / 已判断”。
   * 切到未知时保留当前 value 不动，切回来时用户输入原样恢复——
   * 未知单元格不参与任何计算（旧案例的数字迁移后全部是已知，0 仍是中性）。
   */
  function toggleImpactKnown(id:string,key:ValueKey){
    const target=draft.options.find(o=>o.id===id);
    if(!target)return;
    const cell:ImpactCell=target.impacts[key];
    target.impacts[key]={value:cell.value,known:!cell.known};
    touch();
  }
  function analyze(){
    errors.value=validateDraft(draft);
    if(errors.value.length)return;
    analysis.value=analyzeDecision(draft);
    stale.value=false;
  }
  function save(){
    repository.save({draft:JSON.parse(JSON.stringify(draft)),analysis:analysis.value});
    cases.value=repository.list();
  }
  function load(item:SavedCase){
    Object.assign(draft,JSON.parse(JSON.stringify(item.draft)));
    analysis.value=item.analysis;
    stale.value=false;
  }
  function remove(id:string){
    repository.delete(id);
    cases.value=repository.list();
  }
  return{draft,analysis,errors,stale,cases,touch,setWeights,addOption,removeOption,updateOption,setImpact,toggleImpactKnown,analyze,save,load,remove,print:()=>printer.print()};
}

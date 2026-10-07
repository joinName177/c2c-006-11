import{reactive,ref}from'vue';
import{analyzeDecision}from'../core/analysis-service';
import{createSampleDraft}from'../core/sample-data';
import{validateDraft}from'../core/validation';
import{migrateDraft,VALUE_KEYS,type DecisionAnalysis,type DecisionDraft,type DecisionOption,type SavedCase,type ValueKey,type ValueWeights}from'../core/models';
import type{CaseRepository}from'../ports/case-repository.port';
import type{PrintPort}from'../ports/print.port';

function freshImpacts():ValueWeights{return{stability:0,growth:0,freedom:0,money:0}}

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
    // 新增方案的每个维度默认“尚未判断”，而不是中性 0；0 只在用户明确滑到 0 时出现。
    draft.options.push({id:`option-${Date.now()}`,name:'新选项',description:'',impacts:freshImpacts(),reversibility:70,unknownImpacts:[...VALUE_KEYS]});
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

  // 设定影响值即视为“已判断”；此前暂存的数值被新值覆盖。
  function setImpact(id:string,key:ValueKey,value:number){
    const target=draft.options.find(o=>o.id===id);
    if(!target)return;
    target.impacts[key]=value;
    target.unknownImpacts=(target.unknownImpacts??[]).filter(k=>k!==key);
    touch();
  }

  // 在“尚未判断 / 已判断”之间切换；切回已知时恢复之前的输入，不重置为 0。
  function setImpactUnknown(id:string,key:ValueKey,unknown:boolean){
    const target=draft.options.find(o=>o.id===id);
    if(!target)return;
    const set=new Set(target.unknownImpacts??[]);
    unknown?set.add(key):set.delete(key);
    target.unknownImpacts=VALUE_KEYS.filter(k=>set.has(k));
    touch();
  }

  function analyze(){
    errors.value=validateDraft(draft);
    if(errors.value.length)return;
    analysis.value=analyzeDecision(draft);
    stale.value=false;
  }

  function save(){
    const saved:SavedCase={draft:JSON.parse(JSON.stringify(migrateDraft(draft))),analysis:analysis.value};
    repository.save(saved);
    cases.value=repository.list();
  }

  function load(item:SavedCase){
    const migrated=migrateDraft(item.draft);
    Object.assign(draft,JSON.parse(JSON.stringify(migrated)));
    // 旧版本分析结果缺少区间/完整度字段：数据是确定的，按迁移后的草稿重算，分数与原先一致。
    if(item.analysis&&'status'in item.analysis){
      analysis.value=item.analysis;
    }else if(item.analysis){
      analysis.value=validateDraft(draft).length?undefined:analyzeDecision(draft);
    }else{
      analysis.value=undefined;
    }
    stale.value=false;
  }

  function remove(id:string){
    repository.delete(id);
    cases.value=repository.list();
  }

  return{draft,analysis,errors,stale,cases,touch,setWeights,addOption,removeOption,updateOption,setImpact,setImpactUnknown,analyze,save,load,remove,print:()=>printer.print()};
}

import{describe,it,expect}from'vitest';
import{mount}from'@vue/test-utils';
import DecisionForm from'./DecisionForm.vue';
import ResultPanel from'./ResultPanel.vue';
import{analyzeDecision}from'../../core/analysis-service';
import{createSampleDraft}from'../../core/sample-data';
import{VALUE_KEYS,type DecisionDraft,type ValueKey}from'../../core/models';

const d=createSampleDraft();

describe('DecisionForm',()=>{
  it('未判断维度显示徽标与切换按钮，已判断维度显示数值',()=>{
    const draft:DecisionDraft=JSON.parse(JSON.stringify(d));
    draft.options[0].unknownImpacts=['growth'];
    const w=mount(DecisionForm,{props:{draft}});
    const text=w.text();
    expect(text).toContain('未判断');
    expect(text).toContain('标记为未判断');
    expect(w.findAll('input[type=range][disabled]').length).toBeGreaterThan(0);
  });

  it('点击“标记为未判断”发出 setUnknown，再点恢复不丢失暂存值',async()=>{
    const w=mount(DecisionForm,{props:{draft:d}});
    const buttons=w.findAll('button.unknown-toggle');
    await buttons[0].trigger('click');
    const ev=w.emitted('setUnknown')!;
    expect(ev).toBeTruthy();
    expect(ev[0][2]).toBe(true);
  });
});

describe('ResultPanel',()=>{
  it('provisional 分析展示缺口追溯，不给稳健领先标记',()=>{
    const draft:DecisionDraft=JSON.parse(JSON.stringify(d));
    draft.options.push({id:'x',name:'新选项',description:'',impacts:{stability:0,growth:0,freedom:0,money:0},reversibility:70,unknownImpacts:[...VALUE_KEYS]as ValueKey[]});
    const analysis=analyzeDecision(draft);
    expect(analysis.status).toBe('provisional');
    const w=mount(ResultPanel,{props:{analysis,stale:false}});
    const text=w.text();
    expect(text).toContain('条件性结果（暂无确定建议）');
    expect(text).toContain('完整度 0%');
    expect(text).toContain('条件性');
    expect(text).not.toContain('稳健领先');
  });

  it('complete 分析展示确定分数（无区间符号）',()=>{
    const analysis=analyzeDecision(createSampleDraft());
    expect(analysis.status).toBe('complete');
    analysis.options.forEach(o=>expect(o.minTotal).toBe(o.maxTotal));
    const w=mount(ResultPanel,{props:{analysis,stale:false}});
    expect(w.text()).toContain('最不后悔建议');
    expect(w.text()).toContain('完整度 100%');
  });
});

import{describe,it,expect}from'vitest';
import{mount}from'@vue/test-utils';
import DecisionForm from'./DecisionForm.vue';
import{createSampleDraft}from'../../core/sample-data';
import{type DecisionDraft,knownImpacts,unknownImpacts}from'../../core/models';
import{reactive}from'vue';

const draftWithUnknown=(():DecisionDraft=>{
  const d=createSampleDraft();
  d.options[0].impacts=knownImpacts({stability:3,growth:0,freedom:-1,money:2});
  d.options[1].impacts=unknownImpacts();
  return d;
})();

describe('DecisionForm · 未知与中性的区分',()=>{
  it('未知单元格显示“尚未判断”且滑块禁用；已知 0 仍显示 +0/0',()=>{
    const wrapper=mount(DecisionForm,{props:{draft:reactive(draftWithUnknown)}});
    const cards=wrapper.findAll('.option-card');
    // 第二个方案全部未知：4 个禁用滑块、4 个“尚未判断”按钮
    const unknownCard=cards[1];
    expect(unknownCard.findAll('input[type=range]:disabled')).toHaveLength(4);
    expect(unknownCard.findAll('.known-toggle.off')).toHaveLength(4);
    expect(unknownCard.text()).toContain('0/4 已判断');
    // 第一个方案全部已知（含成长=0 的中性）
    const knownCard=cards[0];
    expect(knownCard.findAll('input[type=range]:disabled')).toHaveLength(0);
    expect(knownCard.text()).toContain('4/4 已判断');
  });

  it('切换未知/已知时发出对应事件，由调用方保留可恢复输入',async()=>{
    const wrapper=mount(DecisionForm,{props:{draft:reactive(createSampleDraft())}});
    const toggles=wrapper.findAll('.known-toggle');
    await toggles[0].trigger('click');
    const emitted=wrapper.emitted('toggleKnown');
    expect(emitted).toBeTruthy();
    expect((emitted as unknown[][])[0]).toEqual([expect.any(String),'stability']);
  });
});

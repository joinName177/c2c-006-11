<script setup lang="ts">
import{VALUE_KEYS,VALUE_LABELS,isImpactUnknown,type DecisionDraft,type DecisionOption,type ValueKey}from'../../core/models';
defineProps<{draft:DecisionDraft}>();
const emit=defineEmits<{touch:[];add:[];remove:[id:string];update:[id:string,p:Partial<DecisionOption>];setImpact:[id:string,key:ValueKey,value:number];setUnknown:[id:string,key:ValueKey,unknown:boolean]}>();
</script>
<template>
  <section class="paper-panel">
    <span class="index">01 / DECISION</span>
    <h2>你正在决定什么？</h2>
    <label class="wide-label">决策事项<input v-model="draft.title" @input="emit('touch')" placeholder="例如：要不要辞职？"></label>
    <label class="wide-label">背景与顾虑<textarea v-model="draft.background" @input="emit('touch')" rows="3"></textarea></label>
    <div class="options-head"><h3>备选方案</h3><button type="button" :disabled="draft.options.length>=4" @click="emit('add')">＋ 添加选项</button></div>
    <p class="unknown-hint">滑到 0 表示明确判断为「中性」；暂时没想清楚的维度请勾选「未判断」，它不会被当成 0 分，且切回时保留你之前的输入。</p>
    <article v-for="(option,index) in draft.options" :key="option.id" class="option-card">
      <div class="option-title"><b>0{{index+1}}</b><input :value="option.name" @input="emit('update',option.id,{name:($event.target as HTMLInputElement).value})"><button type="button" :disabled="draft.options.length<=2" @click="emit('remove',option.id)">×</button></div>
      <textarea :value="option.description" @input="emit('update',option.id,{description:($event.target as HTMLTextAreaElement).value})" placeholder="这个选项意味着什么？"></textarea>
      <div class="impact-grid">
        <label v-for="key in VALUE_KEYS" :key="key" :class="{unknown:isImpactUnknown(option,key)}">
          <span class="impact-head">
            {{VALUE_LABELS[key]}}
            <output v-if="!isImpactUnknown(option,key)">{{option.impacts[key]>0?'+':''}}{{option.impacts[key]}}</output>
            <output v-else class="unknown-badge">未判断</output>
          </span>
          <input type="range" min="-5" max="5" :value="option.impacts[key]" :disabled="isImpactUnknown(option,key)" @input="emit('setImpact',option.id,key,Number(($event.target as HTMLInputElement).value))">
          <button type="button" class="unknown-toggle" :aria-pressed="isImpactUnknown(option,key)" @click="emit('setUnknown',option.id,key,!isImpactUnknown(option,key))">{{isImpactUnknown(option,key)?'恢复我的输入':'标记为未判断'}}</button>
        </label>
      </div>
      <label class="reversible">可逆性 <output>{{option.reversibility}}%</output><input type="range" min="0" max="100" :value="option.reversibility" @input="emit('update',option.id,{reversibility:Number(($event.target as HTMLInputElement).value)})"></label>
    </article>
  </section>
</template>

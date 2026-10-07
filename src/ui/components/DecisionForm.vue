<script setup lang="ts">
import{computed}from'vue';
import{VALUE_KEYS,VALUE_LABELS,type DecisionDraft,type DecisionOption,type ValueKey}from'../../core/models';
const props=defineProps<{draft:DecisionDraft}>();
const emit=defineEmits<{touch:[];add:[];remove:[id:string];update:[id:string,p:Partial<DecisionOption>];setImpact:[id:string,key:ValueKey,value:number];toggleKnown:[id:string,key:ValueKey]}>();
const totalCells=computed(()=>props.draft.options.length*VALUE_KEYS.length);
const knownCells=computed(()=>props.draft.options.reduce((n,o)=>n+VALUE_KEYS.filter(k=>o.impacts[k].known).length,0));
function knownCount(option:DecisionOption){return VALUE_KEYS.filter(k=>option.impacts[k].known).length}
</script>
<template>
  <section class="paper-panel">
    <span class="index">01 / DECISION</span>
    <h2>你正在决定什么？</h2>
    <label class="wide-label">决策事项
      <input v-model="draft.title" @input="emit('touch')" placeholder="例如：要不要辞职？">
    </label>
    <label class="wide-label">背景与顾虑
      <textarea v-model="draft.background" @input="emit('touch')" rows="3"></textarea>
    </label>
    <div class="options-head">
      <h3>备选方案 <small class="completeness-hint">已判断 {{knownCells}}/{{totalCells}} 项影响 · 未判断不等于中性（0）</small></h3>
      <button type="button" :disabled="draft.options.length>=4" @click="emit('add')">＋ 添加选项</button>
    </div>
    <article v-for="(option,index) in draft.options" :key="option.id" class="option-card">
      <div class="option-title">
        <b>0{{index+1}}</b>
        <input :value="option.name" @input="emit('update',option.id,{name:($event.target as HTMLInputElement).value})">
        <span class="option-complete" :class="{partial:knownCount(option)<VALUE_KEYS.length}">{{knownCount(option)}}/{{VALUE_KEYS.length}} 已判断</span>
        <button type="button" :disabled="draft.options.length<=2" @click="emit('remove',option.id)">×</button>
      </div>
      <textarea :value="option.description" @input="emit('update',option.id,{description:($event.target as HTMLTextAreaElement).value})" placeholder="这个选项意味着什么？"></textarea>
      <div class="impact-grid">
        <label v-for="key in VALUE_KEYS" :key="key" :class="{unknown:!option.impacts[key].known}">
          {{VALUE_LABELS[key]}}
          <button type="button" class="known-toggle" :class="{off:!option.impacts[key].known}"
            :title="option.impacts[key].known?'标记为尚未判断（当前数值会被保留）':'恢复判断（沿用上次输入的数值）'"
            @click="emit('toggleKnown',option.id,key)">
            {{option.impacts[key].known?'已判断':'尚未判断'}}
          </button>
          <output v-if="option.impacts[key].known">{{option.impacts[key].value>0?'+':''}}{{option.impacts[key].value}}</output>
          <output v-else class="unknown-output">—</output>
          <input type="range" min="-5" max="5" :value="option.impacts[key].value" :disabled="!option.impacts[key].known"
            @input="emit('setImpact',option.id,key,Number(($event.target as HTMLInputElement).value))">
        </label>
      </div>
      <label class="reversible">可逆性 <output>{{option.reversibility}}%</output>
        <input type="range" min="0" max="100" :value="option.reversibility" @input="emit('update',option.id,{reversibility:Number(($event.target as HTMLInputElement).value)})">
      </label>
    </article>
  </section>
</template>

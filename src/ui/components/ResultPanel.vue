<script setup lang="ts">
import{VALUE_LABELS,type DecisionAnalysis,type ValueKey}from'../../core/models';
import RegretCurve from'./RegretCurve.vue';
defineProps<{analysis:DecisionAnalysis;stale:boolean}>();
const labels=(keys:ValueKey[])=>keys.map(k=>VALUE_LABELS[k]).join('、');
</script>
<template>
  <section class="results">
    <div v-if="stale" class="stale-note">输入已变化，下方是上一次分析结果，请重新计算。</div>
    <div class="recommendation" :class="analysis.status">
      <span>THE LEAST REGRETFUL PATH</span>
      <h2>{{analysis.status==='provisional'?'条件性结果（暂无确定建议）':'最不后悔建议'}}</h2>
      <p>{{analysis.recommendation}}</p>
      <div v-if="analysis.status==='robust-with-gaps'" class="gap-note">仍有缺口，但在最不利估计下结论不变；补齐后建议重新计算复核。</div>
      <ul v-if="analysis.status==='provisional'&&analysis.blockingGaps.length" class="gap-list">
        <li v-for="gap in analysis.blockingGaps" :key="gap.optionId">「{{gap.optionName}}」缺少：
          <b v-for="k in gap.keys" :key="k">{{VALUE_LABELS[k]}}　</b>
        </li>
      </ul>
      <aside v-for="notice in analysis.notices" :key="notice">{{notice}}</aside>
    </div>
    <RegretCurve :options="analysis.options"/>
    <div class="score-grid">
      <article v-for="(item,index) in analysis.options" :key="item.option.id" :class="{winner:analysis.winnerId===item.option.id,provisional:!analysis.winnerId}">
        <span>#0{{index+1}} · 完整度 {{item.completeness}}%<template v-if="item.unknownKeys.length">（缺 {{labels(item.unknownKeys)}}）</template></span>
        <h3>{{item.option.name}}<i v-if="analysis.winnerId===item.option.id" class="winner-tag">稳健领先</i></h3>
        <b>
          <template v-if="item.minTotal===item.maxTotal">{{item.total}}</template>
          <template v-else>{{item.minTotal}}–{{item.maxTotal}}</template>
          <small>/100（{{item.minTotal===item.maxTotal?'确定':'可能区间，中点 '+item.total}}）</small>
        </b>
        <div><i v-for="p in item.points" :key="p.horizon">{{p.horizon}}年 {{p.min===p.max?p.score:`${p.min}–${p.max}`}}</i></div>
      </article>
    </div>
    <div class="rehearsals">
      <article v-for="item in analysis.options" :key="item.option.id">
        <h3>{{item.option.name}} · 后悔预演</h3>
        <div v-for="card in item.cards" :key="card.horizon" :class="{tentative:card.tentative}">
          <b>{{card.horizon}} 年后<em v-if="card.tentative&&card.missingKey" class="tentative-tag">条件性 · {{VALUE_LABELS[card.missingKey]}}未判断</em></b>
          <p>{{card.regret}}</p>
          <small>{{card.trigger}} {{card.reversibility}}；{{card.action}}</small>
        </div>
      </article>
    </div>
  </section>
</template>

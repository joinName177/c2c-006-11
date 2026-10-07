<script setup lang="ts">
import{VALUE_KEYS,VALUE_LABELS,type DecisionAnalysis}from'../../core/models';
import RegretCurve from'./RegretCurve.vue';
defineProps<{analysis:DecisionAnalysis;stale:boolean}>();
const rangeText=(best?:number,worst?:number,total?:number)=>{
  if(best===undefined||worst===undefined||best===worst)return String(total);
  return`${best}–${worst}`;
};
</script>
<template>
  <section class="results">
    <div v-if="stale" class="stale-note">输入已变化，下方是上一次分析结果，请重新计算。</div>

    <div class="completeness-banner" :class="analysis.recommendationStatus">
      <b>判断完整度</b>
      <span>相关影响已判断 {{analysis.relevantCells}}/{{analysis.relevantCells+analysis.relevantGapCount}} 项
        <template v-if="analysis.irrelevantGapCount"> · 另有 {{analysis.irrelevantGapCount}} 项位于零权重维度</template>
      </span>
      <p v-if="analysis.recommendationStatus==='definitive'">所有参与比较的影响均已判断，以下为确定结果。</p>
      <p v-else-if="analysis.recommendationStatus==='robust'">存在 {{analysis.relevantGapCount}} 项尚未判断，但领先方案在最不利情形下仍成立——以下为条件性结果，补齐后请重新推演。</p>
      <p v-else>存在 {{analysis.relevantGapCount}} 项尚未判断且可能改变排名：正式建议已阻止，以下仅为带明确区间的临时分析，不会把未知当作中性 0。</p>
    </div>

    <div class="recommendation" :class="analysis.recommendationStatus">
      <span>THE LEAST REGRETFUL PATH</span>
      <h2>{{analysis.recommendationStatus==='definitive'?'最不后悔建议':analysis.recommendationStatus==='robust'?'条件性建议':'暂无正式建议'}}</h2>
      <p>{{analysis.recommendation}}</p>
      <aside v-for="notice in analysis.notices" :key="notice">{{notice}}</aside>
    </div>

    <RegretCurve :options="analysis.options"/>

    <div class="gap-panel" v-if="analysis.gaps.length">
      <h3>判断缺口（可追溯）</h3>
      <ul>
        <li v-for="gap in analysis.gaps" :key="gap.optionId+gap.key" :class="{irrelevant:!gap.relevant}">
          「{{gap.optionName}}」的{{VALUE_LABELS[gap.key]}}尚未判断
          <small>{{gap.relevant?'影响本次比较':'该维度权重为 0，不影响本次比较，但仍保留'}}</small>
        </li>
      </ul>
    </div>
    <div class="assumption-panel" v-if="analysis.assumptions.length">
      <h3>临时分析口径</h3>
      <p v-for="(a,i) in analysis.assumptions" :key="i">{{a}}</p>
    </div>

    <div class="score-grid">
      <article v-for="(item,index) in analysis.options" :key="item.option.id" :class="{winner:analysis.winnerId===item.option.id}">
        <span>#0{{index+1}}<i v-if="item.relevantGapKeys.length" class="provisional-tag">临时排序</i></span>
        <h3>{{item.option.name}}</h3>
        <b>{{rangeText(item.totalBest,item.totalWorst,item.total)}}<small>/100</small></b>
        <small v-if="item.totalBest!==item.totalWorst" class="range-note">最差→最好情形区间；单值表示相关影响已全部判断</small>
        <div>
          <i v-for="p in item.points" :key="p.horizon">{{p.horizon}}年 {{rangeText(p.scoreBest,p.scoreWorst,p.score)}}</i>
        </div>
        <div class="cell-track">
          <i v-for="k in VALUE_KEYS" :key="k" :class="{missing:!item.option.impacts[k].known}">
            {{VALUE_LABELS[k]}}：{{item.option.impacts[k].known?item.option.impacts[k].value:'未判断'}}
          </i>
        </div>
      </article>
    </div>

    <div class="rehearsals">
      <article v-for="item in analysis.options" :key="item.option.id">
        <h3>{{item.option.name}} · 后悔预演</h3>
        <div v-for="card in item.cards" :key="card.horizon">
          <b>{{card.horizon}} 年后</b>
          <p>{{card.regret}}</p>
          <small>{{card.trigger}} {{card.reversibility}}；{{card.action}}</small>
          <small v-if="card.gapNote" class="card-gap">{{card.gapNote}}</small>
        </div>
      </article>
    </div>
  </section>
</template>

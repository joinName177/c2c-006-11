<script setup lang="ts">
import{ref,computed}from'vue';
import type{OptionAnalysis}from'../../core/models';
const props=defineProps<{options:OptionAnalysis[]}>();
const hidden=ref(new Set<string>());
const colors=['#4f5db7','#d58a32','#8b5f88','#3b8667'];
const x=(i:number)=>70+i*180;
const y=(score:number)=>230-score*1.75;
const path=(o:OptionAnalysis)=>o.points.map((p,i)=>`${i?'L':'M'} ${x(i)} ${y(p.score)}`).join(' ');
function toggle(id:string){const next=new Set(hidden.value);next.has(id)?next.delete(id):next.add(id);hidden.value=next}
const visible=computed(()=>props.options.filter(o=>!hidden.value.has(o.option.id)));
const colorOf=(o:OptionAnalysis)=>colors[props.options.indexOf(o)];
</script>
<template>
  <div class="curve-card">
    <div class="curve-head">
      <div><span>REGRET OVER TIME</span><h3>后悔曲线</h3><p class="range-note">实线为区间中点（条件性估计），竖线为尚未判断维度对应的可能范围；区间越大，确定度越低。</p></div>
      <div class="legend">
        <button v-for="(o,i) in options" :key="o.option.id" :class="{off:hidden.has(o.option.id)}" @click="toggle(o.option.id)"><i :style="{background:colors[i]}"></i>{{o.option.name}}</button>
      </div>
    </div>
    <svg viewBox="0 0 500 280" role="img" aria-label="各选项未来十年的后悔指数区间曲线">
      <g class="grid">
        <line v-for="v in [0,25,50,75,100]" :key="v" x1="55" x2="460" :y1="y(v)" :y2="y(v)"/>
        <text v-for="v in [0,25,50,75,100]" :key="`t${v}`" x="22" :y="y(v)+4">{{v}}</text>
      </g>
      <g v-for="o in visible" :key="o.option.id">
        <line v-for="(p,i) in o.points" :key="`r${p.horizon}`" :x1="x(i)" :x2="x(i)" :y1="y(p.max)" :y2="y(p.min)" :stroke="colorOf(o)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".7"><title>{{o.option.name}} · {{p.horizon}}年可能区间：{{p.min}}–{{p.max}}</title></line>
        <circle v-for="(p,i) in o.points" :key="`c${p.horizon}`" :cx="x(i)" :cy="y(p.min)" r="2.6" :fill="colorOf(o)"/>
        <path :d="path(o)" fill="none" :stroke="colorOf(o)" stroke-width="4"/>
        <circle v-for="(p,i) in o.points" :key="p.horizon" :cx="x(i)" :cy="y(p.score)" r="6" :fill="colorOf(o)"><title>{{o.option.name}} · {{p.horizon}}年：{{p.score}}（可能 {{p.min}}–{{p.max}}）</title></circle>
      </g>
      <text v-for="(h,i) in [1,5,10]" :key="h" :x="x(i)" y="268" text-anchor="middle">{{h}} 年后</text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import{ref,computed}from'vue';
import type{OptionAnalysis,RegretPoint}from'../../core/models';
const props=defineProps<{options:OptionAnalysis[]}>();
const hidden=ref(new Set<string>());
const colors=['#4f5db7','#d58a32','#8b5f88','#3b8667'];
const x=(i:number)=>70+i*180;
const y=(score:number)=>230-score*1.75;
const val=(p:RegretPoint,bound:'best'|'worst'|'mid')=>bound==='best'?(p.scoreBest??p.score):bound==='worst'?(p.scoreWorst??p.score):p.score;
const line=(o:OptionAnalysis,bound:'best'|'worst'|'mid')=>o.points.map((p,i)=>`${i?'L':'M'} ${x(i)} ${y(val(p,bound))}`).join(' ');
const hasRange=(o:OptionAnalysis)=>o.points.some(p=>p.scoreBest!==undefined&&p.scoreBest!==p.scoreWorst);
/** 区间带：最好路径正向连接、最差路径反向连接围成的多边形 */
const band=(o:OptionAnalysis)=>{
  const top=o.points.map((p,i)=>`${i?'L':'M'} ${x(i)} ${y(p.scoreBest??p.score)}`);
  const bottom=o.points.slice().reverse().map((p,i)=>`L ${x(o.points.length-1-i)} ${y(p.scoreWorst??p.score)}`);
  return[...top,...bottom,'Z'].join(' ');
};
function toggle(id:string){const next=new Set(hidden.value);next.has(id)?next.delete(id):next.add(id);hidden.value=next}
const visible=computed(()=>props.options.filter(o=>!hidden.value.has(o.option.id)));
</script>
<template>
  <div class="curve-card">
    <div class="curve-head">
      <div><span>REGRET OVER TIME</span><h3>后悔曲线</h3></div>
      <div class="legend">
        <button v-for="(o,i) in props.options" :key="o.option.id" :class="{off:hidden.has(o.option.id)}" @click="toggle(o.option.id)">
          <i :style="{background:colors[i]}"></i>{{o.option.name}}<small v-if="hasRange(o)" class="legend-range">区间</small>
        </button>
      </div>
    </div>
    <svg viewBox="0 0 500 280" role="img" aria-label="各选项未来十年的后悔指数曲线，半透明色带表示尚未判断影响导致的最好到最差情形区间">
      <g class="grid">
        <line v-for="v in [0,25,50,75,100]" :key="v" x1="55" x2="460" :y1="y(v)" :y2="y(v)"/>
        <text v-for="v in [0,25,50,75,100]" :key="`t${v}`" x="22" :y="y(v)+4">{{v}}</text>
      </g>
      <g v-for="o in visible" :key="o.option.id">
        <path v-if="hasRange(o)" :d="band(o)" :fill="colors[props.options.indexOf(o)]" fill-opacity=".14"/>
        <path v-if="hasRange(o)" :d="line(o,'best')" fill="none" :stroke="colors[props.options.indexOf(o)]" stroke-width="2" stroke-dasharray="6 5" opacity=".55"/>
        <path v-if="hasRange(o)" :d="line(o,'worst')" fill="none" :stroke="colors[props.options.indexOf(o)]" stroke-width="2" stroke-dasharray="2 4" opacity=".8"/>
        <path v-if="!hasRange(o)" :d="line(o,'mid')" fill="none" :stroke="colors[props.options.indexOf(o)]" stroke-width="4"/>
        <template v-for="(p,i) in o.points" :key="p.horizon">
          <circle v-if="!hasRange(o)" :cx="x(i)" :cy="y(p.score)" r="6" :fill="colors[props.options.indexOf(o)]">
            <title>{{o.option.name}} · {{p.horizon}}年：{{p.score}}</title>
          </circle>
          <g v-else>
            <circle :cx="x(i)" :cy="y(p.scoreBest!)" r="4" :fill="colors[props.options.indexOf(o)]" opacity=".6"><title>{{o.option.name}} · {{p.horizon}}年最好情形：{{p.scoreBest}}</title></circle>
            <circle :cx="x(i)" :cy="y(p.scoreWorst!)" r="4" :fill="colors[props.options.indexOf(o)]"><title>{{o.option.name}} · {{p.horizon}}年最差情形：{{p.scoreWorst}}（含未判断影响）</title></circle>
          </g>
        </template>
      </g>
      <text v-for="(h,i) in [1,5,10]" :key="h" :x="x(i)" y="268" text-anchor="middle">{{h}} 年后</text>
    </svg>
    <p v-if="visible.some(hasRange)" class="curve-note">实线为确定评分；虚线与色带表示尚未判断影响下的「最好 → 最差」区间（未知按 +5/−5 假设，绝不按 0）。</p>
  </div>
</template>

<script setup lang="ts">
import{VALUE_KEYS,unknownKeysOf,type SavedCase}from'../../core/models';
defineProps<{cases:SavedCase[]}>();
const emit=defineEmits<{load:[c:SavedCase];remove:[id:string]}>();
function completeness(item:SavedCase){
  const total=item.draft.options.length*VALUE_KEYS.length;
  const unknown=item.draft.options.reduce((n,o)=>n+unknownKeysOf(o).length,0);
  return Math.round((total-unknown)/total*100);
}
</script>
<template>
  <aside class="case-library">
    <span>ARCHIVE</span>
    <h3>决策档案</h3>
    <p v-if="!cases.length">保存结果后会出现在这里。</p>
    <article v-for="item in cases" :key="item.draft.id">
      <button @click="emit('load',item)">
        <b>{{item.draft.title}}</b>
        <small>{{new Date(item.draft.updatedAt).toLocaleDateString()}} · 完整度 {{completeness(item)}}%<template v-if="completeness(item)<100"> · 含未判断项</template></small>
      </button>
      <button aria-label="删除案例" @click="emit('remove',item.draft.id)">×</button>
    </article>
  </aside>
</template>

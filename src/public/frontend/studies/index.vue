<!-- Studies feature entry view bound to studies composable state. -->
<template>
  <section>
    <p>Feature Studies reorganizada para Composition API modular.</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useStudies } from './useStudies';

const { loadStatus, loadQueue } = useStudies();

onMounted(async () => {
  await Promise.all([loadStatus(), loadQueue()]);
});
</script>

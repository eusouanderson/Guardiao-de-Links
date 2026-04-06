<!-- Links feature view (UI only) that binds to links composable actions/state. -->
<template>
  <section>
    <p>Feature Links reorganizada para Composition API modular.</p>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useLinks } from './useLinks';

const { loadLinks } = useLinks();
onMounted(loadLinks);
</script>

<script setup>
defineProps({ service: { type: Object, required: true } });
</script>

<template>
  <div :class="['service-status', `service-${service.state}`]" role="status">
    <span class="status-pulse" aria-hidden="true"/>
    <span>{{ service.message || (service.state === 'online' ? 'Analysis service ready' : 'Checking analysis service') }}</span>
  </div>
</template>

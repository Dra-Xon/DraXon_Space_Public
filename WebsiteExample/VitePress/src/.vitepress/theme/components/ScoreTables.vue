<template>
  <div ref="tablesRoot" class="video-info-tables">
    <div
      v-for="(group, groupIndex) in tableGroups"
      :key="groupIndex"
      class="video-info-table-group"
      :class="{ 'video-info-top-pair': group.pair }"
    >
      <div
        v-for="(table, tableIndex) in group.tables"
        :key="tableIndex"
        class="video-info-table-wrapper"
        :class="{
          'video-info-table-wrapper--left': group.pair && tableIndex === 0,
          'video-info-table-wrapper--right': group.pair && tableIndex === 1
        }"
      >
        <table
          class="video-info-table"
          :aria-label="getTableLabel(group, table, tableIndex)"
        >
          <tbody>
            <tr v-for="(row, rowIndex) in table.cells" :key="rowIndex">
              <td v-for="(cell, cellIndex) in row" :key="cellIndex"><template
                v-for="(part, partIndex) in splitMusicNotes(cell)" :key="partIndex"
              ><template v-if="part.note && /参数6/i.test(row[0])"><span class="overture-bpm-note" role="img" aria-label="符号1" v-html="overtureBpmSvg"></span><span v-if="part.text.endsWith('𝅭')" aria-label="附点">·</span></template><span v-else-if="part.note" class="music-note">{{ part.text }}</span><template
                v-else>{{ part.text }}</template></template></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import overtureBpmSvg from '../../../public/symbols/overture-bpm.svg?raw'

const props = defineProps({
  groups: { type: String, required: true }
})

const tableGroups = computed(() => JSON.parse(decodeURIComponent(props.groups)))
function splitMusicNotes(cell) {
  // U+1D16D is the combining augmentation dot; keep it with its note.
  return cell.split(/([♩𝅘𝅥]𝅭?)/u).map(text => ({
    text,
    note: /^[♩𝅘𝅥]𝅭?$/u.test(text)
  }))
}
const tablesRoot = ref(null)
let resizeObserver
let scheduledFrame = 0

function syncPairedRowHeights() {
  const pairs = tablesRoot.value?.querySelectorAll('.video-info-top-pair') ?? []

  for (const pair of pairs) {
    const tables = pair.querySelectorAll(':scope > .video-info-table-wrapper .video-info-table')
    if (tables.length !== 2) continue

    const [leftRows, rightRows] = Array.from(tables, table => Array.from(table.rows))
    if (leftRows.length !== rightRows.length) continue

    // Clear previous measurements first so rows can shrink when the available
    // width grows, then apply the taller natural height to both matching rows.
    for (const row of [...leftRows, ...rightRows]) row.style.height = ''
    for (let index = 0; index < leftRows.length; index += 1) {
      const height = Math.max(
        leftRows[index].getBoundingClientRect().height,
        rightRows[index].getBoundingClientRect().height
      )
      leftRows[index].style.height = `${height}px`
      rightRows[index].style.height = `${height}px`
    }
  }
}

function scheduleRowSync() {
  if (scheduledFrame) cancelAnimationFrame(scheduledFrame)
  scheduledFrame = requestAnimationFrame(() => {
    scheduledFrame = 0
    syncPairedRowHeights()
  })
}

onMounted(async () => {
  await nextTick()
  scheduleRowSync()

  if (typeof ResizeObserver !== 'undefined' && tablesRoot.value) {
    resizeObserver = new ResizeObserver(scheduleRowSync)
    tablesRoot.value.querySelectorAll('.video-info-top-pair').forEach(pair => {
      resizeObserver.observe(pair)
      pair.querySelectorAll('.video-info-table-wrapper').forEach(wrapper => {
        resizeObserver.observe(wrapper)
      })
    })
  }

  document.fonts?.ready.then(scheduleRowSync)
  window.addEventListener('resize', scheduleRowSync, { passive: true })
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', scheduleRowSync)
  if (scheduledFrame) cancelAnimationFrame(scheduledFrame)
})

function getTableLabel(group, table, tableIndex) {
  const label = group.pair
    ? (tableIndex === 0 ? '视频信息表左侧' : '视频信息表右侧')
    : '视频信息表'
  const columns = table.cells[0]?.length ?? 0
  return `${label}（${table.cells.length}行${columns}列）`
}
</script>

<style scoped>
.overture-bpm-note { margin-inline: 0.5em; display: inline-block; height: 1.5em; width: 0.471em; vertical-align: -0.2em; line-height: 0; }
.overture-bpm-note :deep(svg) { display: block; width: 100%; height: 100%; }
</style>

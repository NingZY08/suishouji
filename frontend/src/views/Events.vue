<template>
  <Layout>
    <div class="events-container">
      <el-card>
        <template #header>
          <div class="events-header">
            <h2>事件管理</h2>
            <div class="header-actions">
              <el-button type="primary" @click="$router.push('/create')">创建事件</el-button>
            </div>
          </div>
        </template>
      <div class="events-search">
        <el-form :inline="true" :model="searchForm" class="demo-form-inline">
          <el-form-item label="关键词">
            <el-input v-model="searchForm.keyword" placeholder="标题/内容"></el-input>
          </el-form-item>
          <el-form-item label="事件类型">
            <el-select v-model="searchForm.type" placeholder="选择类型">
              <el-option v-for="item in typeOptions" :key="item" :label="item" :value="item"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="searchForm.status" placeholder="选择状态">
              <el-option label="进行中" value="进行中"></el-option>
              <el-option label="已完成" value="已完成"></el-option>
              <el-option label="已取消" value="已取消"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">搜索</el-button>
            <el-button @click="resetSearch">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
      <!-- 桌面端表格视图 -->
      <el-table :data="eventsData" style="width: 100%" @selection-change="handleSelectionChange" class="desktop-table" @row-click="handleRowClick">
        <el-table-column type="selection" width="55"></el-table-column>
        <el-table-column prop="title" label="标题" min-width="180"></el-table-column>
        <el-table-column prop="type.level1" label="一级分类"></el-table-column>
        <el-table-column prop="type.level2" label="二级分类"></el-table-column>
        <el-table-column prop="type.level3" label="三级分类"></el-table-column>
        <el-table-column prop="startDate" label="开始日期"></el-table-column>
        <el-table-column prop="endDate" label="结束日期"></el-table-column>
        <el-table-column prop="status" label="状态">
          <template #default="scope">
            <el-tag :type="scope.row.status === '进行中' ? 'warning' : scope.row.status === '已完成' ? 'success' : 'danger'">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="scope">
            <div class="table-actions" @click.stop>
              <el-button size="small" @click="viewEvent(scope.row.id)">查看</el-button>
              <el-button size="small" type="primary" @click="editEvent(scope.row.id)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteEvent(scope.row.id)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <!-- 移动端卡片视图 -->
      <div class="mobile-cards">
        <div v-for="event in eventsData" :key="event.id" class="event-card" @click="viewEvent(event.id)">
          <div class="card-row card-title-row" @click.stop>
            <el-checkbox v-model="event.selected" @change="handleCardSelectionChange"></el-checkbox>
            <span class="card-label">标题</span>
            <span class="card-value">{{ event.title }}</span>
          </div>
          <div class="card-row" v-if="event.type && event.type.level1">
            <span class="card-label">一级分类</span>
            <span class="card-value">{{ event.type.level1 }}</span>
          </div>
          <div class="card-row" v-if="event.type && event.type.level2">
            <span class="card-label">二级分类</span>
            <span class="card-value">{{ event.type.level2 }}</span>
          </div>
          <div class="card-row" v-if="event.type && event.type.level3">
            <span class="card-label">三级分类</span>
            <span class="card-value">{{ event.type.level3 }}</span>
          </div>
          <div class="card-row">
            <span class="card-label">开始日期</span>
            <span class="card-value">{{ event.startDate }}</span>
          </div>
          <div class="card-row">
            <span class="card-label">结束日期</span>
            <span class="card-value">{{ event.endDate }}</span>
          </div>
          <div class="card-row">
            <span class="card-label">状态</span>
            <span class="card-value">
              <el-tag :type="event.status === '进行中' ? 'warning' : event.status === '已完成' ? 'success' : 'danger'">
                {{ event.status }}
              </el-tag>
            </span>
          </div>
          <div class="card-row card-actions" @click.stop>
            <el-button size="small" @click="viewEvent(event.id)">查看</el-button>
            <el-button size="small" type="primary" @click="editEvent(event.id)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteEvent(event.id)">删除</el-button>
          </div>
        </div>
      </div>
      <div class="events-pagination">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
      <div class="events-actions">
        <el-button type="danger" @click="batchDelete" :disabled="selectedEvents.length === 0">批量删除</el-button>
        <el-button @click="exportToExcel">导出Excel</el-button>
      </div>
    </el-card>
  </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Layout from '../components/Layout.vue'
import { useEventStore } from '../store/modules/event'
import axios from '../utils/axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const route = useRoute()
const eventStore = useEventStore()

const searchForm = reactive({
  keyword: '',
  type: '',
  status: ''
})

const typeOptions = ref<string[]>([])

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100]

// 从 sessionStorage 还原每页条数，查看详情/编辑返回后不丢设置
const storedPageSize = Number(sessionStorage.getItem('eventsPageSize'))
const pagination = reactive({
  currentPage: 1,
  pageSize: ALLOWED_PAGE_SIZES.includes(storedPageSize) ? storedPageSize : 10,
  total: 0
})

const selectedEvents = ref<string[]>([])
const eventsData = ref<any[]>([])

const handleSelectionChange = (val: any[]) => {
  selectedEvents.value = val.map(item => item.id)
}

const handleCardSelectionChange = () => {
  selectedEvents.value = eventsData.value.filter(e => e.selected).map(e => e.id)
}

const handleRowClick = (row: any) => {
  viewEvent(row.id)
}

const fetchTypeOptions = async () => {
  try {
    const response = await axios.get('/api/events/categories')
    typeOptions.value = response.data.map((item: any) => item.name)
  } catch (error) {
    console.error('获取分类选项失败:', error)
  }
}

const handleSearch = async () => {
  pagination.currentPage = 1
  persistPage()
  await fetchEvents()
}

const resetSearch = () => {
  searchForm.keyword = ''
  searchForm.type = ''
  searchForm.status = ''
  pagination.currentPage = 1
  persistPage()
  fetchEvents()
}

const handleSizeChange = (size: number) => {
  pagination.pageSize = size
  sessionStorage.setItem('eventsPageSize', String(size))
  persistPage()
  fetchEvents()
}

const handleCurrentChange = (current: number) => {
  pagination.currentPage = current
  persistPage()
  fetchEvents()
}

// 把当前页码同步到地址栏（/events?page=N），组件销毁后页码仍保存在 URL 里；
// 同时写入 sessionStorage，供“新建/编辑保存后返回列表”时使用。
const persistPage = () => {
  const page = String(pagination.currentPage)
  sessionStorage.setItem('eventsPage', page)
  if (route.query.page !== page) {
    router.replace({ query: { ...route.query, page } })
  }
}

// 通过浏览器前进/后退回到本页时（组件被复用、不重新挂载），同步页码并刷新列表
watch(() => route.query.page, (val) => {
  const page = Number(Array.isArray(val) ? val[0] : val)
  if (Number.isInteger(page) && page > 0 && page !== pagination.currentPage) {
    pagination.currentPage = page
    fetchEvents()
  }
})

const fetchEvents = async () => {
  try {
    const response = await axios.get('/api/events', {
      params: {
        ...searchForm,
        page: pagination.currentPage,
        pageSize: pagination.pageSize
      }
    })
    eventsData.value = response.data.events
    pagination.total = response.data.total
    eventStore.setEvents(response.data.events)
    await nextTick()
    addDataLabels()
  } catch (error) {
    console.error('获取事件列表失败:', error)
    ElMessage.error('获取事件列表失败')
  }
}

const addDataLabels = () => {
  const labels = ['标题', '一级分类', '二级分类', '三级分类', '开始日期', '结束日期', '状态', '操作']
  setTimeout(() => {
    console.log('===== 移动端表格调试信息 =====')
    console.log('当前窗口宽度:', window.innerWidth)
    console.log('是否为移动端 (<=768px):', window.innerWidth <= 768)
    
    const rows = document.querySelectorAll('.el-table__body .el-table__row')
    console.log('找到行数:', rows.length)
    
    // 调试：输出容器宽度信息
    const container = document.querySelector('.events-container')
    const card = document.querySelector('.el-card')
    const table = document.querySelector('.el-table')
    const tableBody = document.querySelector('.el-table__body')
    console.log('容器宽度:', container?.clientWidth, '卡片宽度:', card?.clientWidth)
    console.log('表格宽度:', table?.clientWidth, '表格主体宽度:', tableBody?.clientWidth)
    
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('td')
      console.log(`\n行${rowIndex}:`)
      console.log('  - 行宽度:', row.clientWidth)
      console.log('  - 行 display 样式:', window.getComputedStyle(row).display)
      console.log('  - 单元格数:', cells.length)
      
      cells.forEach((cell, cellIndex) => {
        const dataLabel = cell.getAttribute('data-label')
        console.log(`  - 列${cellIndex}: data-label="${dataLabel}", 宽度:`, cell.clientWidth, 'display:', window.getComputedStyle(cell).display)
        
        if (!cell.classList.contains('el-table-column--selection') && labels[cellIndex]) {
          cell.setAttribute('data-label', labels[cellIndex])
          console.log(`    → 设置 data-label="${labels[cellIndex]}"`)
        }
      })
    })
    console.log('===== 调试信息结束 =====')
  }, 500)
}

const viewEvent = (id: string) => {
  router.push(`/event/${id}`)
}

const editEvent = (id: string) => {
  router.push(`/create?id=${id}`)
}

const deleteEvent = async (id: string) => {
  try {
    await ElMessageBox.confirm('确定要删除这个事件吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await axios.delete(`/api/events/${id}`)
    ElMessage.success('删除成功')
    eventStore.deleteEvent(id)
    fetchEvents()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

const batchDelete = async () => {
  if (selectedEvents.value.length === 0) return
  try {
    await ElMessageBox.confirm('确定要批量删除这些事件吗？', '批量删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await axios.post('/api/events/batch-delete', { ids: selectedEvents.value })
    ElMessage.success('批量删除成功')
    selectedEvents.value.forEach(id => eventStore.deleteEvent(id))
    fetchEvents()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error)
      ElMessage.error('批量删除失败')
    }
  }
}

const exportToExcel = async () => {
  try {
    const response = await axios.get('/api/events/export', {
      params: searchForm,
      responseType: 'blob'
    })
    const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `事件列表_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

onMounted(() => {
  // 从地址栏还原页码：查看详情后返回时，URL 仍是 /events?page=N，据此恢复分页位置
  const page = Number(Array.isArray(route.query.page) ? route.query.page[0] : route.query.page)
  if (Number.isInteger(page) && page > 0) {
    pagination.currentPage = page
  }
  fetchTypeOptions()
  fetchEvents()
})
</script>

<style scoped>
.events-container {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
}

.events-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.events-header h2 {
  margin: 0;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.events-search {
  margin-bottom: 20px;
}

@media (max-width: 1000px) {
  .events-container {
    padding: 10px;
    width: 100%;
  }

  .events-header {
    flex-direction: row;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
  }

  .events-header h2 {
    font-size: 18px;
    margin: 0;
    flex-shrink: 0;
  }

  .header-actions {
    flex-shrink: 0;
  }

  .events-search :deep(.el-form) {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .events-search :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 0;
    width: 100%;
  }

  .events-search :deep(.el-form-item__label) {
    font-size: 14px;
    padding-bottom: 5px;
  }

  .events-search :deep(.el-input),
  .events-search :deep(.el-select) {
    width: 100%;
  }

  .events-search :deep(.el-input__inner) {
    font-size: 16px;
  }

  .events-search :deep(.el-button) {
    flex: 1;
    font-size: 14px;
  }

  .events-search :deep(.el-form-item:last-child) {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
}

.el-select {
  min-width: 120px;
}

.table-actions {
  display: flex;
  gap: 5px;
}

@media (max-width: 1000px) {
  /* 强制容器宽度 */
  .events-container,
  .events-container > *,
  .el-card,
  .el-card__body {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box;
    margin: 0 !important;
    padding-left: 10px !important;
    padding-right: 10px !important;
    overflow: visible !important;
  }

  .el-card__body {
    padding: 10px !important;
  }

  /* 表格样式完全重写 - 使用最强选择器 */
  .el-table,
  .el-table__body,
  .el-table__body table,
  .el-table__body table tbody,
  .el-table__body table tbody tr {
    width: 100% !important;
    max-width: 100% !important;
    min-width: auto !important;
  }

  .el-table {
    font-size: 14px;
    overflow: visible !important;
  }

  /* 隐藏表头 */
  .el-table__header-wrapper,
  .el-table__header {
    display: none !important;
    visibility: hidden !important;
    height: 0 !important;
    overflow: hidden !important;
  }

  /* 每一行作为卡片 - 强制 block 布局 */
  .el-table__body .el-table__row,
  .el-table__body .el-table__row > * {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box;
  }

  .el-table__body .el-table__row {
    margin-bottom: 20px;
    border: 2px solid #dcdfe6;
    border-radius: 12px;
    padding: 15px;
    background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    position: relative;
  }

  .el-table__body .el-table__row:hover {
    background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%) !important;
  }

  /* 强制单元格为 block 布局 */
  .el-table__body .el-table__row td,
  .el-table__body .el-table__row .el-table__cell {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 8px 0 !important;
    border: none !important;
    border-bottom: 1px dashed #e4e7ed !important;
    box-sizing: border-box;
    text-align: left !important;
    float: none !important;
    position: static !important;
  }

  .el-table__body .el-table__row td:last-child,
  .el-table__body .el-table__row .el-table__cell:last-child {
    border-bottom: none !important;
    padding-bottom: 0 !important;
  }

  .el-table__body .el-table__row td:first-child,
  .el-table__body .el-table__row .el-table__cell:first-child {
    padding-top: 0 !important;
  }

  /* 复选框列特殊处理 */
  .el-table__body .el-table-column--selection {
    border-bottom: 1px dashed #e4e7ed !important;
    padding-bottom: 12px !important;
    margin-bottom: 12px !important;
  }

  /* 列标签显示 - 改为上下布局 */
  .el-table__body .el-table__row td[data-label]::before {
    content: attr(data-label);
    display: block;
    font-weight: 600;
    color: #909399;
    font-size: 13px;
    text-align: left;
    margin-bottom: 4px;
  }

  /* 单元格内容 - 改为左对齐，占满整行 */
  .el-table__body .el-table__row .el-table__cell,
  .el-table__body .el-table__row .el-table__cell .cell {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    text-align: left !important;
    color: #303133;
    font-size: 14px;
    line-height: 1.6;
    word-break: break-word;
    padding-left: 0 !important;
    padding-right: 0 !important;
    box-sizing: border-box;
    min-width: 0 !important;
    white-space: normal !important;
    overflow-wrap: break-word !important;
    word-wrap: break-word !important;
  }

  /* 状态标签样式优化 */
  .el-table__body .el-table__row .el-table__cell .el-tag {
    display: inline-block;
    margin: 0;
    white-space: nowrap !important;
  }

  /* 操作按钮 - 改为垂直排列 */
  .el-table__body .el-table__row .table-actions {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    width: 100% !important;
  }

  .el-table__body .el-table__row .table-actions .el-button {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 10px 20px;
    font-size: 14px;
    text-align: center;
    white-space: nowrap !important;
  }
}

/* 桌面端保持原有样式 */
.events-pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1000px) {
  .events-pagination {
    justify-content: flex-start;
    margin-top: 15px;
  }

  .events-pagination :deep(.el-pagination) {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    gap: 5px;
    width: 100%;
  }

  /* 第一行：total, sizes, prev, pager, next - 强制为一组不拆散 */
  .events-pagination :deep(.el-pagination__total) {
    order: 1;
    flex: 0 0 auto;
    font-size: 12px;
    white-space: nowrap;
  }

  .events-pagination :deep(.el-pagination__sizes) {
    order: 2;
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .events-pagination :deep(.el-pagination__sizes .el-select) {
    width: 80px;
    font-size: 12px;
  }

  .events-pagination :deep(.btn-prev) {
    order: 3;
    flex: 0 0 auto;
    padding: 0 4px;
    min-width: 24px;
    font-size: 12px;
    white-space: nowrap;
  }

  .events-pagination :deep(.el-pager) {
    order: 4;
    flex: 0 0 auto;
    display: flex !important;
    flex-wrap: nowrap !important;
    white-space: nowrap;
    margin: 0 !important;
  }

  .events-pagination :deep(.el-pager li) {
    min-width: 24px;
    height: 24px;
    line-height: 24px;
    font-size: 12px;
    margin: 0 2px !important;
    flex-shrink: 0;
  }

  .events-pagination :deep(.btn-next) {
    order: 5;
    flex: 0 0 auto;
    padding: 0 4px;
    min-width: 24px;
    font-size: 12px;
    white-space: nowrap;
  }

  /* 第二行：jumper 单独占一行 */
  .events-pagination :deep(.el-pagination__jump) {
    order: 6;
    flex-basis: 100%;
    margin-top: 8px;
    margin-left: 0;
    text-align: left;
    font-size: 12px;
    padding-left: 0;
  }

  .events-pagination :deep(.el-pagination__jump .el-input) {
    width: 45px;
  }
}

.events-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
  width: 100%;
}

/* 移动端卡片样式 */
.mobile-cards {
  display: none;
}

.desktop-table {
  display: block;
}

@media (max-width: 1000px) {
  .mobile-cards {
    display: block;
    width: 100%;
  }

  .desktop-table {
    display: none;
  }

  .event-card {
    background: linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%);
    border: 2px solid #dcdfe6;
    border-radius: 10px;
    padding: 10px;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 0;
    border-bottom: 1px dashed #e4e7ed;
    min-height: 26px;
  }

  .card-title-row {
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #e4e7ed;
    margin-bottom: 5px;
  }

  .card-title-row .el-checkbox {
    flex-shrink: 0;
  }

  .card-title-row .card-label {
    min-width: auto;
    flex-shrink: 0;
  }

  .card-title-row .card-value {
    flex: 1;
    min-width: 0;
  }

  .card-row:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  .card-row:first-child {
    padding-top: 0;
  }

  .card-label {
    font-weight: 600;
    color: #909399;
    font-size: 12px;
    min-width: 70px;
    flex-shrink: 0;
  }

  .card-value {
    flex: 1;
    text-align: right;
    color: #303133;
    font-size: 13px;
    line-height: 1.4;
    word-break: break-word;
    padding-left: 10px;
    min-width: 0;
  }

  .card-actions {
    flex-direction: row !important;
    justify-content: center;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 2px dashed #e4e7ed;
  }

  .card-actions .el-button {
    width: auto;
    min-width: 70px;
    padding: 6px 15px;
    font-size: 13px;
    margin: 0;
  }
}

@media (max-width: 1000px) {
  .events-actions {
    display: flex;
    flex-direction: row;
    justify-content: center;
    gap: 10px;
    margin-top: 15px;
    width: 100%;
    max-width: 100%;
  }

  .events-actions .el-button {
    flex: 1;
    font-size: 14px;
    text-align: center;
    display: flex;
    justify-content: center;
    align-items: center;
  }
}
</style>
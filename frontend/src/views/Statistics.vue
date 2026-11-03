<template>
  <Layout>
    <div class="statistics-container">
      <el-card>
        <template #header>
          <div class="statistics-header">
            <h2>数据统计</h2>
          </div>
        </template>
      <div class="statistics-filters">
        <el-form :inline="true" :model="filterForm" class="demo-form-inline">
          <el-form-item label="时间范围">
            <el-date-picker
              v-model="filterForm.dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              @change="handleDateChange"
            ></el-date-picker>
          </el-form-item>
          <el-form-item label="事件类型">
            <el-select v-model="filterForm.type" placeholder="选择类型">
              <el-option label="全部" value=""></el-option>
              <el-option label="工作" value="工作"></el-option>
              <el-option label="生活" value="生活"></el-option>
              <el-option label="学习" value="学习"></el-option>
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleSearch">查询</el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="statistics-charts">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-header">
                  <h3>事件类型分布</h3>
                </div>
              </template>
              <div id="typeChart" class="chart"></div>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-header">
                  <h3>事件状态分布</h3>
                </div>
              </template>
              <div id="statusChart" class="chart"></div>
            </el-card>
          </el-col>
        </el-row>
        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="24">
            <el-card class="chart-card">
              <template #header>
                <div class="chart-header">
                  <h3>事件数量趋势</h3>
                </div>
              </template>
              <div id="trendChart" class="chart"></div>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import axios from '../utils/axios'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'

const filterForm = reactive({
  dateRange: [],
  type: ''
})

const typeChart = ref<echarts.ECharts | null>(null)
const statusChart = ref<echarts.ECharts | null>(null)
const trendChart = ref<echarts.ECharts | null>(null)

const handleDateChange = (val: any) => {
  filterForm.dateRange = val || []
}

const handleSearch = () => {
  fetchStatistics()
}

const fetchStatistics = async () => {
  try {
    const response = await axios.get('/api/statistics', {
      params: {
        startDate: filterForm.dateRange[0] ? filterForm.dateRange[0] : '',
        endDate: filterForm.dateRange[1] ? filterForm.dateRange[1] : '',
        type: filterForm.type
      }
    })
    const data = response.data
    renderTypeChart(data.typeDistribution)
    renderStatusChart(data.statusDistribution)
    renderTrendChart(data.trend)
  } catch (error: any) {
    console.error('获取统计数据失败:', error)
    ElMessage.error(error?.response?.data?.message || '获取统计数据失败，请稍后重试')
  }
}

const renderTypeChart = (data: any[]) => {
  const chartDom = document.getElementById('typeChart')
  if (!chartDom) return
  if (!typeChart.value) {
    typeChart.value = echarts.init(chartDom)
  }
  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      top: '5%',
      left: 'center'
    },
    series: [
      {
        name: '事件类型',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  }
  typeChart.value.setOption(option)
}

const renderStatusChart = (data: any[]) => {
  const chartDom = document.getElementById('statusChart')
  if (!chartDom) return
  if (!statusChart.value) {
    statusChart.value = echarts.init(chartDom)
  }
  const option = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
      top: '5%',
      left: 'center'
    },
    series: [
      {
        name: '事件状态',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data
      }
    ]
  }
  statusChart.value.setOption(option)
}

const renderTrendChart = (data: any[]) => {
  const chartDom = document.getElementById('trendChart')
  if (!chartDom) return
  if (!trendChart.value) {
    trendChart.value = echarts.init(chartDom)
  }
  const option = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      data: data.map(item => item.date)
    },
    yAxis: {
      type: 'value'
    },
    series: [
      {
        data: data.map(item => item.count),
        type: 'line',
        smooth: true
      }
    ]
  }
  trendChart.value.setOption(option)
}

const handleResize = () => {
  typeChart.value?.resize()
  statusChart.value?.resize()
  trendChart.value?.resize()
}

// const handleLogout = async () => {
//   try {
//     await ElMessageBox.confirm('确定要登出吗？', '登出确认', {
//       confirmButtonText: '确定',
//       cancelButtonText: '取消',
//       type: 'info'
//     })
//     userStore.logout()
//     ElMessage.success('登出成功')
//     router.push('/login')
//   } catch (error) {
//     if (error !== 'cancel') {
//       console.error('登出失败:', error)
//       ElMessage.error('登出失败')
//     }
//   }
// }

onMounted(() => {
  fetchStatistics()
  window.addEventListener('resize', handleResize)
})
</script>

<style scoped>
.statistics-container {
  padding: 20px;
}

.statistics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.statistics-header h2 {
  margin: 0;
  color: #303133;
}

.statistics-filters {
  margin-bottom: 20px;
}

.el-select {
  min-width: 120px;
}

@media (max-width: 768px) {
  :deep(.el-form-item) {
    display: block;
    margin-bottom: 15px;
  }

  :deep(.el-select) {
    width: 100%;
  }

  :deep(.el-date-editor) {
    width: 100% !important;
  }
}

.statistics-charts {
  margin-top: 20px;
}

.chart-card {
  height: 400px;
}

.chart-header {
  display: flex;
  justify-content: center;
}

.chart-header h3 {
  margin: 0;
  color: #606266;
}

.chart {
  width: 100%;
  height: 340px;
}
</style>
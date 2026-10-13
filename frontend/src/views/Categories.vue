<template>
  <Layout>
    <div class="categories-container">
      <el-card class="box-card">
        <template #header>
          <div class="card-header">
            <span>分类管理</span>
            <el-button type="primary" @click="handleAddCategory">
              <el-icon><Plus /></el-icon>
              添加分类
            </el-button>
          </div>
        </template>

      <!-- 分类树 -->
      <el-tree
        :data="categoryTree"
        :props="defaultProps"
        node-key="id"
        ref="treeRef"
        @node-click="handleNodeClick"
        :highlight-current="true"
        class="category-tree"
      >
        <template #default="{ data }">
          <div class="tree-node">
            <span>{{ data.name }}</span>
            <span class="node-level-tag">
              <el-tag size="small" type="info">{{ data.level }}级</el-tag>
            </span>
          </div>
        </template>
      </el-tree>

      <!-- 操作按钮区域 -->
      <div class="category-actions" v-if="selectedCategory">
        <el-divider content-position="left">操作：{{ selectedCategory.name }}</el-divider>
        <div class="action-buttons">
          <el-button
            type="primary"
            @click="handleAddSubCategory(selectedCategory)"
            :disabled="selectedCategory.level >= 3"
          >
            <el-icon><Plus /></el-icon>
            添加子分类
          </el-button>
          <el-button type="warning" @click="handleEditCategory(selectedCategory)">
            <el-icon><Edit /></el-icon>
            编辑
          </el-button>
          <el-button type="danger" @click="handleDeleteCategory(selectedCategory)">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
      </div>
      <div v-else class="category-actions-empty">
        <el-empty description="请选择一个分类进行操作" :image-size="80" />
      </div>
    </el-card>

    <!-- 添加/编辑分类对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="400px"
    >
      <el-form
        :model="categoryForm"
        :rules="rules"
        ref="categoryFormRef"
        label-width="80px"
      >
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="categoryForm.name" placeholder="请输入分类名称" />
        </el-form-item>
        <el-form-item label="分类级别" prop="level">
          <el-select v-model="categoryForm.level" placeholder="请选择分类级别" disabled>
            <el-option label="一级分类" value="1" />
            <el-option label="二级分类" value="2" />
            <el-option label="三级分类" value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="父分类" prop="parentId" v-if="categoryForm.level > 1">
          <el-select v-model="categoryForm.parentId" placeholder="请选择父分类">
            <el-option
              v-for="item in parentOptions"
              :key="item.id"
              :label="item.name"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="categoryForm.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
  </Layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Edit, Delete } from '@element-plus/icons-vue'
import axios from '../utils/axios'

// 分类接口定义
interface Category {
  id: number
  parentId: number | null
  name: string
  level: number
  sortOrder: number
  children?: Category[]
}

// 响应式数据
const categoryTree = ref<Category[]>([])
const selectedCategory = ref<Category | null>(null)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const categoryForm = reactive({
  id: 0,
  name: '',
  level: 1,
  parentId: null,
  sortOrder: 0
})
const treeRef = ref()
const categoryFormRef = ref()

// 验证规则
const rules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 50, message: '分类名称长度在1到50个字符之间', trigger: 'blur' }
  ]
}

// 树节点配置
const defaultProps = {
  children: 'children',
  label: 'name'
}

// 父分类选项（根据当前级别动态计算）
const parentOptions = computed(() => {
  if (categoryForm.level === 1) return []
  if (categoryForm.level === 2) {
    return categoryTree.value
  }
  if (categoryForm.level === 3) {
    // 找到当前选中的二级分类的父级一级分类
    for (const level1 of categoryTree.value) {
      for (const level2 of level1.children || []) {
        if (level2.id === categoryForm.parentId) {
          return level1.children || []
        }
      }
    }
    return []
  }
  return []
})

// 获取分类树
const fetchCategories = async () => {
  try {
    const response = await axios.get('/api/categories')
    categoryTree.value = response.data
  } catch (error) {
    console.error('获取分类失败:', error)
    ElMessage.error('获取分类失败')
  }
}

// 处理节点点击
const handleNodeClick = (data: Category) => {
  selectedCategory.value = data
  console.log('选中节点:', data)
}

// 处理添加分类
const handleAddCategory = () => {
  dialogTitle.value = '添加分类'
  categoryForm.id = 0
  categoryForm.name = ''
  categoryForm.level = 1
  categoryForm.parentId = null
  categoryForm.sortOrder = 0
  dialogVisible.value = true
}

// 处理添加子分类
const handleAddSubCategory = (data: Category) => {
  if (data.level >= 3) {
    ElMessage.warning('最多只能创建三级分类')
    return
  }
  dialogTitle.value = '添加子分类'
  categoryForm.id = 0
  categoryForm.name = ''
  categoryForm.level = data.level + 1
  categoryForm.parentId = data.id as any
  categoryForm.sortOrder = 0
  dialogVisible.value = true
}

// 处理编辑分类
const handleEditCategory = (data: Category) => {
  dialogTitle.value = '编辑分类'
  categoryForm.id = data.id
  categoryForm.name = data.name
  categoryForm.level = data.level as any
  categoryForm.parentId = data.parentId as any
  categoryForm.sortOrder = data.sortOrder
  dialogVisible.value = true
}

// 处理删除分类
const handleDeleteCategory = async (data: Category) => {
  try {
    await ElMessageBox.confirm('确定要删除这个分类吗？', '删除确认', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await axios.delete(`/api/categories/${data.id}`)
    ElMessage.success('删除成功')
    fetchCategories()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 处理表单提交
const handleSubmit = async () => {
  if (!categoryFormRef.value) return
  
  try {
    await categoryFormRef.value.validate()
    
    if (categoryForm.id) {
      // 更新分类
      await axios.put(`/api/categories/${categoryForm.id}`, {
        name: categoryForm.name,
        sortOrder: categoryForm.sortOrder
      })
      ElMessage.success('更新成功')
    } else {
      // 创建分类
      await axios.post('/api/categories', {
        name: categoryForm.name,
        level: categoryForm.level,
        parentId: categoryForm.parentId,
        sortOrder: categoryForm.sortOrder
      })
      ElMessage.success('创建成功')
    }
    
    dialogVisible.value = false
    fetchCategories()
  } catch (error) {
    console.error('操作失败:', error)
    ElMessage.error('操作失败')
  }
}

// 生命周期钩子
onMounted(() => {
  fetchCategories()
})
</script>

<style scoped>
.categories-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.category-tree {
  margin-top: 20px;
  min-height: 300px;
}

.tree-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-right: 10px;
}

.node-level-tag {
  flex-shrink: 0;
}

.category-actions {
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.category-actions-empty {
  margin-top: 20px;
  padding: 20px;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 手机端样式 */
@media (max-width: 768px) {
  .categories-container {
    max-width: 100%;
    padding: 10px;
  }
  
  .category-actions .action-buttons {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    justify-content: flex-start !important;
    align-items: flex-start !important;
  }
  
  .category-actions .action-buttons .el-button {
    flex: 0 0 calc(33.333% - 7px) !important;
    min-width: 100px !important;
    margin: 0 !important;
  }
  
  /* 当屏幕宽度小于395px时，垂直排列 */
  @media (max-width: 395px) {
    .category-actions .action-buttons {
      flex-direction: column !important;
      align-items: center !important;
    }
    
    .category-actions .action-buttons .el-button {
      width: 50% !important;
      min-width: auto !important;
      margin: 0 !important;
    }
  }
}
</style>
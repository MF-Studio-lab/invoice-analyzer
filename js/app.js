// Invoice Analyzer - Main Application Logic v2.0.1

class InvoiceAnalyzer {
    constructor() {
        this.invoices = [];
        this.filteredInvoices = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.monthlyChart = null;
        this.categoryChart = null;
        this.invoiceMap = new Map(); // 用於去重

        this.init();
    }

    init() {
        this.loadFromLocalStorage();
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.checkFirstVisit();
    }

    checkFirstVisit() {
        const hasVisited = localStorage.getItem('invoiceAnalyzer_visited');
        if (!hasVisited) {
            // 首次訪問，顯示幫助 Modal
            setTimeout(() => {
                this.showHelpModal();
            }, 500);
            localStorage.setItem('invoiceAnalyzer_visited', 'true');
        }
    }

    setupEventListeners() {
        // File input
        const fileInput = document.getElementById('csvFileInput');
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));

        // Drop zone click
        const dropZone = document.getElementById('dropZone');
        dropZone.addEventListener('click', () => fileInput.click());

        // Search input
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.handleSearch(e));

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        exportBtn.addEventListener('click', () => this.exportToCSV());

        // Clear data button
        const clearDataBtn = document.getElementById('clearDataBtn');
        clearDataBtn.addEventListener('click', () => this.clearAllData());

        // Help button
        const helpBtn = document.getElementById('helpBtn');
        helpBtn.addEventListener('click', () => this.showHelpModal());

        // Chart period selector
        const chartPeriod = document.getElementById('chartPeriod');
        chartPeriod.addEventListener('change', () => this.updateMonthlyChart());

        // Modal close buttons
        document.getElementById('closeModalBtn').addEventListener('click', () => this.hideHelpModal());
        document.getElementById('closeModalBtnBottom').addEventListener('click', () => this.hideHelpModal());

        // Close modal on backdrop click
        document.getElementById('helpModal').addEventListener('click', (e) => {
            if (e.target.id === 'helpModal') {
                this.hideHelpModal();
            }
        });

        // Pagination buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());

        // Toggle other category breakdown
        const toggleOtherBtn = document.getElementById('toggleOtherBreakdown');
        const otherSection = document.getElementById('otherBreakdownSection');
        const otherList = document.getElementById('otherBreakdownList');
        const toggleIcon = document.getElementById('toggleOtherIcon');
        const toggleText = document.getElementById('toggleOtherText');
        if (toggleOtherBtn) {
            toggleOtherBtn.addEventListener('click', () => {
                const isHidden = otherSection.classList.toggle('hidden');
                if (!isHidden) {
                    // Populate the list when showing
                    this.updateOtherBreakdownList();
                }
                // Toggle icon
                toggleIcon.classList.toggle('rotate-180');
                toggleText.textContent = isHidden ? '顯示其他類別詳細' : '隱藏其他類別詳細';
            });
        }
    }

    setupDragAndDrop() {
        const dropZone = document.getElementById('dropZone');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('dragover');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processMultipleFiles(files);
            }
        });
    }

    handleFileUpload(event) {
        const files = event.target.files;
        if (files.length > 0) {
            this.processMultipleFiles(files);
        }
    }

    async processMultipleFiles(files) {
        const totalFiles = files.length;
        let processedCount = 0;
        let newInvoices = [];
        let duplicateCount = 0;
        let duplicateInvoices = []; // 記錄被剔除的重複項目

        // 顯示進度條
        this.showUploadProgress();

        // 處理每個檔案
        for (let i = 0; i < totalFiles; i++) {
            const file = files[i];
            if (!file.name.endsWith('.csv')) {
                console.warn(`跳過非 CSV 檔案: ${file.name}`);
                continue;
            }

            try {
                const fileInvoices = await this.parseCSVFile(file);
                
                // 去重處理 - 只在多個檔案之間進行去重，使用發票號碼作為唯一鍵
                // 單一檔案內不進行去重，因為同一張發票可能有多個相同品項
                // 將同一張發票的所有品項作為一個整體處理
                const invoiceMap = new Map(); // 暫存本檔案的發票
                
                fileInvoices.forEach(invoice => {
                    if (!invoiceMap.has(invoice.invoiceNumber)) {
                        invoiceMap.set(invoice.invoiceNumber, []);
                    }
                    invoiceMap.get(invoice.invoiceNumber).push(invoice);
                });
                
                // 檢查每張發票是否已存在
                invoiceMap.forEach((items, invoiceNumber) => {
                    if (!this.invoiceMap.has(invoiceNumber)) {
                        // 新發票，添加所有品項
                        this.invoiceMap.set(invoiceNumber, items);
                        newInvoices.push(...items);
                    } else {
                        // 重複發票，記錄所有品項為重複
                        duplicateCount += items.length;
                        duplicateInvoices.push(...items);
                    }
                });

                processedCount++;
                this.updateProgress((processedCount / totalFiles) * 100);

            } catch (error) {
                console.error(`處理檔案 ${file.name} 時發生錯誤:`, error);
            }
        }

        // 隱藏進度條
        this.hideUploadProgress();

        // 如果有新資料，更新系統
        if (newInvoices.length > 0) {
            // 合併新資料到現有資料 - 將發票數組展平為單一數組
            this.invoices = Array.from(this.invoiceMap.values()).flat();
            
            // 按日期排序
            this.sortInvoicesByDate();
            
            // 更新過濾後的資料
            this.filteredInvoices = [...this.invoices];
            this.currentPage = 1;

            // 儲存到 localStorage
            this.saveToLocalStorage();

            // 更新 UI
            this.updateUI();
            this.displayFileInfo(newInvoices.length, duplicateCount, duplicateInvoices);
        } else {
            alert('沒有找到新的發票記錄（所有發票都已存在）');
        }
    }


    _getCategoryFromStore(store) {
        if (!store) return null;
        const s = store.trim();
        // Define keyword -> category mappings
        const rules = [
            { keywords: ['至盛科技','燦坤','富邦媒體','momo'], category: '3C / 科技' },
            { keywords: ['爭鮮','麥當勞','海景世界','新東陽','五二早餐'], category: '餐飲 / 外食' },
            { keywords: ['秀泰影城','影城'], category: '娛樂' },
            { keywords: ['全聯','家樂福','家福'], category: '超市' },
            { keywords: ['7-11','7-ELEVEN','7 十一','超商','統一超商','全家'], category: '便利商店' },
            { keywords: ['中油','千越加油站','國雲科技','加油站','加油'], category: '加油 / 交通' },
            { keywords: ['歐巴螞食品'], category: '烘焙' },
            { keywords: ['Google','Netflix'], category: '數位訂閱' },
            { keywords: ['台東農會'], category: '伴手禮' },
            { keywords: ['正統百貨五金行'], category: '日用品' },
            { keywords: ['藏壽司'], category: '迴轉壽司' }
        ];
        for (const rule of rules) {
            for (const kw of rule.keywords) {
                if (s.includes(kw)) {
                    return rule.category;
                }
            }
        }
        return null; // will go to 其他
    }
    parseCSVFile(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: 'UTF-8',
                complete: (results) => {
                    const invoices = results.data.map((row, index) => {
                        const amount = this.findAmount(row);
                        const date = this.findDate(row);
                        const item = this.findItem(row);
                        const store = this.findStore(row);
                        const category = this._getCategoryFromStore(store) || '其他';
                        const invoiceNumber = this.findInvoiceNumber(row);

                        return {
                            id: Date.now() + index, // 使用時間戳確保唯一性
                            date: this.parseDate(date),
                            amount: this.parseAmount(amount),
                            item: item || '未指定品項',
                            category: category,
                            store: store || '未指定商店',
                            invoiceNumber: invoiceNumber || `INV-${Date.now()}-${index}`
                        };
                    }).filter(invoice => invoice.amount > 0); // 過濾無效記錄

                    resolve(invoices);
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    findAmount(row) {
        const amountFields = ['發票金額', '消費金額', '金額', 'Amount', 'amount', '總金額', 'Total', '消費明細_金額'];
        for (const field of amountFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findDate(row) {
        const dateFields = ['日期', 'Date', 'date', '發票日期', 'InvoiceDate', '時間'];
        for (const field of dateFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findItem(row) {
        const itemFields = ['品項', '品名', '消費明細_品名', 'Item', 'item', '商品名稱', 'Product', 'Description'];
        for (const field of itemFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findStore(row) {
        const storeFields = ['商店名稱', '店名', 'Store', 'store', '賣方名稱', 'Seller', '商家'];
        for (const field of storeFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findInvoiceNumber(row) {
        const invoiceFields = ['發票號碼', 'InvoiceNumber', 'invoice', '發票號', 'No'];
        for (const field of invoiceFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    parseDate(dateStr) {
        if (!dateStr) return new Date().toISOString().split('T')[0];

        const formats = [
            /^\d{4}-\d{2}-\d{2}$/,           // 2026-03-30
            /^\d{2}\/\d{2}\/\d{4}$/,         // 03/30/2026
            /^\d{4}\/\d{2}\/\d{2}$/,         // 2026/03/30
            /^\d{4}\d{2}\d{2}$/,             // 20260330
            /^\d{8}$/                         // 20260330 (8位數字)
        ];

        for (const format of formats) {
            if (format.test(dateStr)) {
                let date;
                
                // 處理 8 位數字格式 (20260330)
                if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
                    const year = dateStr.substring(0, 4);
                    const month = dateStr.substring(4, 6);
                    const day = dateStr.substring(6, 8);
                    date = new Date(`${year}-${month}-${day}`);
                } else {
                    date = new Date(dateStr.replace(/\//g, '-'));
                }
                
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }

        // 如果所有格式都不匹配，嘗試直接解析
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }

        // 如果仍然失敗，返回當前日期
        console.warn(`無法解析日期: ${dateStr}，使用當前日期`);
        return new Date().toISOString().split('T')[0];
    }

    parseAmount(amountStr) {
        if (!amountStr) return 0;

        const cleaned = String(amountStr)
            .replace(/[^\d.-]/g, '')
            .replace(/,/g, '');

        const amount = parseFloat(cleaned);
        return isNaN(amount) ? 0 : Math.abs(amount);
    }

    sortInvoicesByDate() {
        this.invoices.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            return dateB - dateA; // 降序排列（最新的在前）
        });
    }

    showUploadProgress() {
        document.getElementById('uploadProgress').classList.remove('hidden');
        this.updateProgress(0);
    }

    hideUploadProgress() {
        document.getElementById('uploadProgress').classList.add('hidden');
    }

    updateProgress(percent) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }

    displayFileInfo(newCount, duplicateCount, duplicateInvoices = []) {
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.classList.remove('hidden');

        document.getElementById('totalImported').textContent = this.invoices.length;
        document.getElementById('duplicateCount').textContent = duplicateCount;

        // 顯示日期範圍
        if (this.invoices.length > 0) {
            const dates = this.invoices.map(inv => inv.date).sort();
            const startDate = dates[0];
            const endDate = dates[dates.length - 1];
            document.getElementById('dateRange').textContent = `${startDate} ~ ${endDate}`;
        }

        // 顯示被剔除的重複項目
        if (duplicateInvoices.length > 0) {
            this.showDuplicateInvoices(duplicateInvoices);
        }

        // 顯示清除資料按鈕
        document.getElementById('clearDataBtn').classList.remove('hidden');
    }

    showDuplicateInvoices(duplicateInvoices) {
        // 創建或更新重複項目顯示區域
        let duplicateSection = document.getElementById('duplicateSection');
        if (!duplicateSection) {
            duplicateSection = document.createElement('div');
            duplicateSection.id = 'duplicateSection';
            duplicateSection.className = 'mt-4 bg-yellow-900 border border-yellow-700 rounded-lg p-4';
            
            const fileInfo = document.getElementById('fileInfo');
            fileInfo.parentNode.insertBefore(duplicateSection, fileInfo.nextSibling);
        }

        // 生成重複項目列表
        const duplicateList = duplicateInvoices.map(inv => `
            <div class="flex items-center justify-between py-2 border-b border-yellow-700 last:border-0">
                <div class="flex-1">
                    <p class="text-yellow-300 text-sm font-medium">${inv.invoiceNumber}</p>
                    <p class="text-yellow-400 text-xs">${inv.date} | ${inv.store}</p>
                </div>
                <div class="text-right">
                    <p class="text-yellow-300 text-sm">${inv.item}</p>
                    <p class="text-yellow-400 text-xs">NT$${inv.amount.toLocaleString()}</p>
                </div>
            </div>
        `).join('');

        duplicateSection.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <div>
                    <p class="text-yellow-300 font-medium">⚠️ 剔除重複項目 (${duplicateInvoices.length} 筆)</p>
                    <p class="text-yellow-400 text-xs mt-1">以下項目因重複已被剔除，請確認是否正確</p>
                </div>
                <button onclick="document.getElementById('duplicateSection').remove()" class="text-yellow-400 hover:text-yellow-300 text-sm">
                    ✕ 關閉
                </button>
            </div>
            <div class="max-h-60 overflow-y-auto">
                ${duplicateList}
            </div>
        `;
    }

    updateUI() {
        if (this.invoices.length === 0) {
            return;
        }

        // 顯示所有區塊
        document.getElementById('statsSection').classList.remove('hidden');
        document.getElementById('chartsSection').classList.remove('hidden');
        document.getElementById('listSection').classList.remove('hidden');

        // 更新統計資料
        this.updateStatistics();

        // 更新圖表
        this.updateCharts();

        // 更新表格
        this.updateTable();
    }

    updateStatistics() {
        const totalAmount = this.invoices.reduce((sum, inv) => sum + inv.amount, 0);
        const avgAmount = totalAmount / this.invoices.length;
        const uniqueStores = new Set(this.invoices.map(inv => inv.store)).size;

        document.getElementById('totalAmount').textContent = this.formatCurrency(totalAmount);
        document.getElementById('totalInvoices').textContent = this.invoices.length;
        document.getElementById('avgAmount').textContent = this.formatCurrency(avgAmount);
        document.getElementById('totalStores').textContent = uniqueStores;
    }

    updateCharts() {
        this.updateMonthlyChart();
        this.updateCategoryChart();
    }

    updateMonthlyChart() {
        const period = document.getElementById('chartPeriod').value;
        const chartData = period === 'monthly' ? this.getMonthlyData() : this.getDailyData();
        const label = period === 'monthly' ? '每月消費金額' : '每日消費金額';

        const ctx = document.getElementById('monthlyChart').getContext('2d');

        if (this.monthlyChart) {
            this.monthlyChart.destroy();
        }

        this.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: label,
                    data: chartData.data,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: {
                            color: '#9ca3af'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#9ca3af',
                            maxTicksLimit: period === 'daily' ? 10 : 12 // 限制 X 軸標籤數量
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        }
                    },
                    y: {
                        ticks: {
                            color: '#9ca3af',
                            callback: (value) => 'NT$' + value.toLocaleString()
                        },
                        grid: {
                            color: 'rgba(75, 85, 99, 0.3)'
                        }
                    }
                }
            }
        });
    }

    updateCategoryChart() {
        const categoryData = this.getCategoryData();

        const ctx = document.getElementById('categoryChart').getContext('2d');

        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.data,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(139, 92, 246, 0.8)',
                        'rgba(236, 72, 153, 0.8)',
                        'rgba(20, 184, 166, 0.8)',
                        'rgba(249, 115, 22, 0.8)'
                    ],
                    borderColor: 'rgba(31, 41, 55, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#9ca3af',
                            padding: 15
                        }
                    }
                }
            }
        });
    }

    getMonthlyData() {
        const monthlyMap = {};

        this.invoices.forEach(inv => {
            const date = new Date(inv.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

            if (!monthlyMap[monthKey]) {
                monthlyMap[monthKey] = 0;
            }
            monthlyMap[monthKey] += inv.amount;
        });

        // 按月份排序
        const sortedMonths = Object.keys(monthlyMap).sort();

        return {
            labels: sortedMonths,
            data: sortedMonths.map(month => monthlyMap[month])
        };
    }

    getDailyData() {
        const dailyMap = {};

        this.invoices.forEach(inv => {
            const dateKey = inv.date; // 使用 YYYY-MM-DD 格式

            if (!dailyMap[dateKey]) {
                dailyMap[dateKey] = 0;
            }
            dailyMap[dateKey] += inv.amount;
        });

        // 按日期排序
        const sortedDates = Object.keys(dailyMap).sort();

        return {
            labels: sortedDates,
            data: sortedDates.map(date => dailyMap[date])
        };
    }

    getCategoryData() {
        const categoryMap = {};
        const otherDetails = [];

        this.invoices.forEach(inv => {
            const rawStore = inv.store || '';
            const category = this._getCategoryFromStore(rawStore);
            if (category === null) {
                // treat as 其他
                if (!categoryMap['其他']) categoryMap['其他'] = 0;
                categoryMap['其他'] += inv.amount;
                otherDetails.push({category: rawStore, amount: inv.amount});
            } else {
                if (!categoryMap[category]) categoryMap[category] = 0;
                categoryMap[category] += inv.amount;
            }
        });

        // Sort categories by amount descending
        const entries = Object.entries(categoryMap)
            .sort((a, b) => b[1] - a[1]);

        const labels = entries.map(e => e[0]);
        const data = entries.map(e => e[1]);

        // Cache other details for breakdown
        this.lastOtherDetails = otherDetails;

        return {
            labels: labels,
            data: data
        };
    }
    getOtherCategoryDetails() {
        return this.lastOtherDetails;
    }
    updateOtherBreakdownList() {
        const otherList = document.getElementById('otherBreakdownList');
        if (!otherList) return;
        const details = this.getOtherCategoryDetails();
        if (details.length === 0) {
            otherList.innerHTML = '<p class="text-gray-400 text-center py-3">無其他類別</p>';
            return;
        }

        // 計算其他類別詳細中的總金額
        const totalOtherAmount = details.reduce((sum, d) => sum + d.amount, 0);

        // 生成表格 HTML
        const tableHTML = `
            <table class="w-full text-sm border-collapse">
                <thead>
                    <tr class="border-b border-gray-600 bg-gray-700">
                        <th class="px-3 py-2 text-left text-gray-200 font-semibold">商店名稱</th>
                        <th class="px-3 py-2 text-right text-gray-200 font-semibold">消費金額</th>
                        <th class="px-3 py-2 text-right text-gray-200 font-semibold">佔比</th>
                    </tr>
                </thead>
                <tbody>
                    ${details.map(d => {
                        const percentage = totalOtherAmount > 0 ? ((d.amount / totalOtherAmount) * 100).toFixed(1) : '0.0';
                        return `
                            <tr class="border-b border-gray-700 hover:bg-gray-800 transition-colors">
                                <td class="px-3 py-2 text-gray-300">${d.category}</td>
                                <td class="px-3 py-2 text-right font-mono text-gray-200">NT$${this.formatCurrency(d.amount)}</td>
                                <td class="px-3 py-2 text-right text-gray-400">${percentage}%</td>
                            </tr>
                        `;
                    }).join('')}
                    <tr class="border-t border-gray-600 bg-gray-800 font-semibold">
                        <td class="px-3 py-2 text-gray-200">合計</td>
                        <td class="px-3 py-2 text-right font-mono text-gray-100">NT$${this.formatCurrency(totalOtherAmount)}</td>
                        <td class="px-3 py-2 text-right text-gray-300">100.0%</td>
                    </tr>
                </tbody>
            </table>
        `;
        otherList.innerHTML = tableHTML;
    }

    // 將 updateTable 函式替換為下面這個版本
    updateTable() {
        const tbody = document.getElementById('invoiceTableBody');
        const noResults = document.getElementById('noResults');
    
        // 計算分頁
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredInvoices.slice(startIndex, endIndex);
    
        // 清空現有行
        tbody.innerHTML = '';
    
        if (pageData.length === 0) {
            noResults.classList.remove('hidden');
        } else {
            noResults.classList.add('hidden');
    
            pageData.forEach(invoice => {
                const row = document.createElement('tr');
                row.className = 'fade-in';
                row.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-300">${invoice.date}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 font-mono">${invoice.invoiceNumber}</td>
                    <td class="px-4 py-3 text-sm text-gray-300">${invoice.store}</td>
                    <td class="px-4 py-3 text-sm text-gray-300">${invoice.item}</td>
                    <td class="px-4 py-3 text-sm text-gray-300">${invoice.category}</td>
                    <td class="px-4 py-3 text-sm text-gray-300 text-right font-medium">${this.formatCurrency(invoice.amount)}</td>
                `;
                tbody.appendChild(row);
            });
        }
    
        // 更新分頁資訊
        this.updatePagination();
    
        // 更新篩選結果累計金額（顯示整個 filteredInvoices 的合計）
        const totalFiltered = this.filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const filteredAmountEl = document.getElementById('filteredTotalAmount');
        if (filteredAmountEl) {
            filteredAmountEl.textContent = this.formatCurrency(totalFiltered);
        }
    }

    updatePagination() {
        const totalRecords = this.filteredInvoices.length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(startIndex + this.itemsPerPage - 1, totalRecords);

        document.getElementById('showingFrom').textContent = totalRecords > 0 ? startIndex : 0;
        document.getElementById('showingTo').textContent = endIndex;
        document.getElementById('totalRecords').textContent = totalRecords;

        // 更新按鈕狀態
        document.getElementById('prevBtn').disabled = this.currentPage === 1;
        document.getElementById('nextBtn').disabled = this.currentPage >= totalPages;
    }

    handleSearch(event) {
        const searchTerm = event.target.value.toLowerCase().trim();

        if (searchTerm === '') {
            this.filteredInvoices = [...this.invoices];
        } else {
            this.filteredInvoices = this.invoices.filter(invoice =>
                invoice.store.toLowerCase().includes(searchTerm) ||
                invoice.item.toLowerCase().includes(searchTerm) ||
                invoice.invoiceNumber.toLowerCase().includes(searchTerm) ||
                invoice.category.toLowerCase().includes(searchTerm)
            );
        }

        this.currentPage = 1;
        this.updateTable();
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateTable();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredInvoices.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updateTable();
        }
    }

    exportToCSV() {
        if (this.filteredInvoices.length === 0) {
            alert('沒有資料可匯出');
            return;
        }

        const headers = ['日期', '發票號碼', '商店名稱', '品項', '金額'];
        const csvContent = [
            headers.join(','),
            ...this.filteredInvoices.map(inv =>
                [
                    inv.date,
                    inv.invoiceNumber,
                    `"${inv.store}"`,
                    `"${inv.item}"`,
                    inv.amount
                ].join(',')
            )
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `發票明細_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    formatCurrency(amount) {
        return 'NT$' + amount.toLocaleString('zh-TW', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    // localStorage 功能
    saveToLocalStorage() {
        try {
            const data = {
                invoices: this.invoices,
                timestamp: Date.now()
            };
            localStorage.setItem('invoiceAnalyzer_data', JSON.stringify(data));
        } catch (error) {
            console.error('儲存到 localStorage 時發生錯誤:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('invoiceAnalyzer_data');
            if (data) {
                const parsed = JSON.parse(data);
                this.invoices = parsed.invoices || [];
                
                // 重建 invoiceMap - 將同一張發票的所有品項存儲為數組
                this.invoiceMap = new Map();
                this.invoices.forEach(invoice => {
                    if (!this.invoiceMap.has(invoice.invoiceNumber)) {
                        this.invoiceMap.set(invoice.invoiceNumber, []);
                    }
                    this.invoiceMap.get(invoice.invoiceNumber).push(invoice);
                });

                this.filteredInvoices = [...this.invoices];
                this.currentPage = 1;

                if (this.invoices.length > 0) {
                    this.updateUI();
                    this.displayFileInfo(0, 0);
                }
            }
        } catch (error) {
            console.error('從 localStorage 載入時發生錯誤:', error);
        }
    }

    clearAllData() {
        if (confirm('確定要清除所有發票資料嗎？此動作無法復原。')) {
            // 清除 localStorage
            localStorage.removeItem('invoiceAnalyzer_data');
            localStorage.removeItem('invoiceAnalyzer_visited');

            // 清除記憶體中的資料
            this.invoices = [];
            this.filteredInvoices = [];
            this.invoiceMap.clear();
            this.currentPage = 1;

            // 銷毀圖表
            if (this.monthlyChart) {
                this.monthlyChart.destroy();
                this.monthlyChart = null;
            }
            if (this.categoryChart) {
                this.categoryChart.destroy();
                this.categoryChart = null;
            }

            // 隱藏所有區塊
            document.getElementById('statsSection').classList.add('hidden');
            document.getElementById('chartsSection').classList.add('hidden');
            document.getElementById('listSection').classList.add('hidden');
            document.getElementById('fileInfo').classList.add('hidden');
            document.getElementById('clearDataBtn').classList.add('hidden');

            alert('資料已清除');
        }
    }

    // Modal 功能
    showHelpModal() {
        document.getElementById('helpModal').classList.remove('hidden');
        document.getElementById('helpModal').classList.add('flex');
    }

    hideHelpModal() {
        document.getElementById('helpModal').classList.add('hidden');
        document.getElementById('helpModal').classList.remove('flex');
    }
}

// 初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    new InvoiceAnalyzer();
});

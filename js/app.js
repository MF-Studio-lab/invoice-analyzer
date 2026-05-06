// Invoice Analyzer - Main Application Logic

class InvoiceAnalyzer {
    constructor() {
        this.invoices = [];
        this.filteredInvoices = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.monthlyChart = null;
        this.categoryChart = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
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

        // Pagination buttons
        document.getElementById('prevBtn').addEventListener('click', () => this.prevPage());
        document.getElementById('nextBtn').addEventListener('click', () => this.nextPage());
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
                this.processFile(files[0]);
            }
        });
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!file.name.endsWith('.csv')) {
            alert('請上傳 CSV 檔案');
            return;
        }

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            encoding: 'UTF-8',
            complete: (results) => {
                this.parseInvoices(results.data);
                this.displayFileInfo(file.name, results.data.length);
            },
            error: (error) => {
                console.error('CSV 解析錯誤:', error);
                alert('CSV 檔案解析失敗，請檢查檔案格式');
            }
        });
    }

    parseInvoices(data) {
        this.invoices = data.map((row, index) => {
            // Try to find the correct column names
            const amount = this.findAmount(row);
            const date = this.findDate(row);
            const item = this.findItem(row);
            const store = this.findStore(row);
            const invoiceNumber = this.findInvoiceNumber(row);

            return {
                id: index + 1,
                date: this.parseDate(date),
                amount: this.parseAmount(amount),
                item: item || '未指定品項',
                store: store || '未指定商店',
                invoiceNumber: invoiceNumber || `INV-${String(index + 1).padStart(6, '0')}`
            };
        }).filter(invoice => invoice.amount > 0); // Filter out invalid records

        this.filteredInvoices = [...this.invoices];
        this.currentPage = 1;

        this.updateUI();
    }

    findAmount(row) {
        // Common column names for amount
        const amountFields = ['消費金額', '金額', 'Amount', 'amount', '總金額', 'Total'];
        for (const field of amountFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findDate(row) {
        // Common column names for date
        const dateFields = ['日期', 'Date', 'date', '發票日期', 'InvoiceDate', '時間'];
        for (const field of dateFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findItem(row) {
        // Common column names for item
        const itemFields = ['品項', '品名', 'Item', 'item', '商品名稱', 'Product', 'Description'];
        for (const field of itemFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findStore(row) {
        // Common column names for store
        const storeFields = ['商店名稱', '店名', 'Store', 'store', '賣方名稱', 'Seller', '商家'];
        for (const field of storeFields) {
            if (row[field] !== undefined && row[field] !== null && row[field] !== '') {
                return row[field];
            }
        }
        return null;
    }

    findInvoiceNumber(row) {
        // Common column names for invoice number
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

        // Try different date formats
        const formats = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
            /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
            /^\d{4}\d{2}\d{2}$/ // YYYYMMDD
        ];

        for (const format of formats) {
            if (format.test(dateStr)) {
                const date = new Date(dateStr.replace(/\//g, '-'));
                if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                }
            }
        }

        // If all else fails, return the original string
        return dateStr;
    }

    parseAmount(amountStr) {
        if (!amountStr) return 0;

        // Remove currency symbols and commas
        const cleaned = String(amountStr)
            .replace(/[^\d.-]/g, '')
            .replace(/,/g, '');

        const amount = parseFloat(cleaned);
        return isNaN(amount) ? 0 : Math.abs(amount);
    }

    displayFileInfo(fileName, recordCount) {
        const fileInfo = document.getElementById('fileInfo');
        fileInfo.classList.remove('hidden');

        document.getElementById('fileName').textContent = fileName;
        document.getElementById('recordCount').textContent = this.invoices.length;
    }

    updateUI() {
        if (this.invoices.length === 0) {
            alert('沒有找到有效的發票記錄');
            return;
        }

        // Show all sections
        document.getElementById('statsSection').classList.remove('hidden');
        document.getElementById('chartsSection').classList.remove('hidden');
        document.getElementById('listSection').classList.remove('hidden');

        // Update statistics
        this.updateStatistics();

        // Update charts
        this.updateCharts();

        // Update table
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
        const monthlyData = this.getMonthlyData();

        const ctx = document.getElementById('monthlyChart').getContext('2d');

        if (this.monthlyChart) {
            this.monthlyChart.destroy();
        }

        this.monthlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [{
                    label: '每月消費金額',
                    data: monthlyData.data,
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
                            color: '#9ca3af'
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

        // Sort by month
        const sortedMonths = Object.keys(monthlyMap).sort();

        return {
            labels: sortedMonths,
            data: sortedMonths.map(month => monthlyMap[month])
        };
    }

    getCategoryData() {
        const categoryMap = {};

        this.invoices.forEach(inv => {
            const category = inv.store || '其他';

            if (!categoryMap[category]) {
                categoryMap[category] = 0;
            }
            categoryMap[category] += inv.amount;
        });

        // Sort by amount (descending) and take top 8
        const sortedCategories = Object.entries(categoryMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8);

        return {
            labels: sortedCategories.map(([name]) => name),
            data: sortedCategories.map(([, amount]) => amount)
        };
    }

    updateTable() {
        const tbody = document.getElementById('invoiceTableBody');
        const noResults = document.getElementById('noResults');

        // Calculate pagination
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredInvoices.slice(startIndex, endIndex);

        // Clear existing rows
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
                    <td class="px-4 py-3 text-sm text-gray-300 text-right font-medium">${this.formatCurrency(invoice.amount)}</td>
                `;
                tbody.appendChild(row);
            });
        }

        // Update pagination info
        this.updatePagination();
    }

    updatePagination() {
        const totalRecords = this.filteredInvoices.length;
        const totalPages = Math.ceil(totalRecords / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endIndex = Math.min(startIndex + this.itemsPerPage - 1, totalRecords);

        document.getElementById('showingFrom').textContent = totalRecords > 0 ? startIndex : 0;
        document.getElementById('showingTo').textContent = endIndex;
        document.getElementById('totalRecords').textContent = totalRecords;

        // Update button states
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
                invoice.invoiceNumber.toLowerCase().includes(searchTerm)
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
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new InvoiceAnalyzer();
});

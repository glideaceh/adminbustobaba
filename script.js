    const GAS_API_URL = "https://script.google.com/macros/s/AKfycbz9oI7WVGzV2nrgAyW965T_2XKw7uxHYkU13ouJVlb8iRzmnVXEPGhDvqtNjxOnKQsYLg/exec";

        let chartInstance = null;
        let globalRawData = {};
        
        let pollingInterval = null;
        let autoSlideInterval = null;
        let lastTopUpCount = 0;
        let lastSubCount = 0;
        let actionCallback = null;
        let currentChartFilter = 'hari'; 
        
        let globalMitraList = [];

        window.addEventListener('DOMContentLoaded', () => {
            checkAutoLogin();
        });

        // ================= DYNAMIC BRANDING LOGIC =================
        function updateBranding(user) {
            const compName = user.namaPerusahaan || "Go Borneo";
            const logoUrl = user.logo || "";
            const adminName = user.namaLengkap || user.username;

            document.getElementById('display-admin-name').innerText = adminName;
            
            const sbName = document.getElementById('sidebar-company-name');
            if(sbName) sbName.innerText = compName;
            const mbName = document.getElementById('mobile-header-company-name');
            if(mbName) mbName.innerText = compName;

            if(logoUrl && logoUrl.trim() !== "") {
                const sbImg = document.getElementById('sidebar-logo-img');
                if(sbImg) { sbImg.src = logoUrl; sbImg.style.display = 'block'; }
                const sbIcon = document.getElementById('sidebar-logo-icon');
                if(sbIcon) sbIcon.style.display = 'none';

                const mbImg = document.getElementById('mobile-header-logo-img');
                if(mbImg) { mbImg.src = logoUrl; mbImg.style.display = 'block'; }
                const mbIcon = document.getElementById('mobile-header-logo-icon');
                if(mbIcon) mbIcon.style.display = 'none';
            }
        }

        function checkAutoLogin() {
            const savedSession = localStorage.getItem('goBorneoAdminSession');
            if (savedSession) {
                try {
                    const user = JSON.parse(savedSession);
                    if (user && user.username) {
                        document.getElementById('view-auth').style.display = 'none';
                        document.getElementById('dashboard-wrapper').style.display = 'block';
                        
                        updateBranding(user); 
                        
                        showLoader("Melanjutkan Sesi Login...");
                        fetchInitialDashboardData();
                        startRealtimePolling();
                        startMetricsAutoSlide();
                    }
                } catch(e) {
                    localStorage.removeItem('goBorneoAdminSession');
                }
            }
        }

        // UI Helpers
        function toggleAuth(view) {
            document.getElementById('form-login').style.display = view === 'login' ? 'block' : 'none';
            document.getElementById('form-register').style.display = view === 'register' ? 'block' : 'none';
        }

        function showLoader(message, isActive = true) {
            const loader = document.getElementById('globalLoader');
            document.getElementById('loadingText').innerText = message;
            if(isActive) { loader.classList.add('active'); }
            else { loader.classList.remove('active'); }
        }

        // Inline Loading Helper for Modal Buttons
        function setBtnLoading(btn, isLoading, textWhenLoading = "Memproses...") {
            if (!btn) return;
            if (isLoading) {
                btn.dataset.originalHtml = btn.innerHTML;
                btn.disabled = true;
                btn.style.opacity = "0.75";
                btn.style.cursor = "not-allowed";
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${textWhenLoading}`;
            } else {
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
                if (btn.dataset.originalHtml) {
                    btn.innerHTML = btn.dataset.originalHtml;
                }
            }
        }

        function showToast(message, isError = false) {
            const toast = document.getElementById('toastAlert');
            const icon = document.getElementById('toastIcon');
            
            toast.style.animation = 'none';
            toast.offsetHeight; 
            toast.style.animation = 'slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';

            document.getElementById('toastMessage').innerText = message;
            if(isError) {
                toast.style.background = "rgba(239, 68, 68, 0.95)";
                icon.className = "fa-solid fa-circle-exclamation";
            } else {
                toast.style.background = "rgba(15, 23, 42, 0.95)";
                icon.className = "fa-solid fa-bell";
            }
            toast.style.display = "flex";
            setTimeout(() => { toast.style.display = "none"; }, 4000);
        }

        function togglePasswordVisibility(inputId, iconEl) {
            const input = document.getElementById(inputId);
            if(input.type === "password") {
                input.type = "text";
                iconEl.classList.remove('fa-eye');
                iconEl.classList.add('fa-eye-slash');
            } else {
                input.type = "password";
                iconEl.classList.remove('fa-eye-slash');
                iconEl.classList.add('fa-eye');
            }
        }

        function formatTanggalIndo(dateStr) {
            if(!dateStr || dateStr === "") return "-";
            let d = new Date(dateStr);
            if(isNaN(d.getTime())) return dateStr;
            const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
            let jam = String(d.getHours()).padStart(2, '0');
            let mnt = String(d.getMinutes()).padStart(2, '0');
            return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}, ${jam}.${mnt} WIB`;
        }

        function formatNumber(num) {
            return num ? num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "0";
        }

        function startMetricsAutoSlide() {
            if (autoSlideInterval) clearInterval(autoSlideInterval);
            const grid = document.getElementById('metricsCarouselGrid');
            if (!grid) return;
            autoSlideInterval = setInterval(() => {
                if (grid.scrollLeft + grid.clientWidth >= grid.scrollWidth - 10) {
                    grid.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    grid.scrollBy({ left: 280, behavior: 'smooth' });
                }
            }, 3500);
            grid.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
            grid.addEventListener('mouseleave', startMetricsAutoSlide);
            grid.addEventListener('touchstart', () => clearInterval(autoSlideInterval));
            grid.addEventListener('touchend', startMetricsAutoSlide);
        }

        function triggerLogoutWarning() {
            document.getElementById('logoutWarningModal').style.display = "flex";
        }
        function closeLogoutModal() {
            document.getElementById('logoutWarningModal').style.display = "none";
        }
        function executeLogout() {
            closeLogoutModal();
            clearInterval(pollingInterval);
            if (autoSlideInterval) clearInterval(autoSlideInterval);
            
            localStorage.removeItem('goBorneoAdminSession');
            document.getElementById('dashboard-wrapper').style.display = 'none';
            document.getElementById('view-auth').style.display = 'flex';
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            showToast("Anda telah berhasil keluar dari sistem.");
        }

        function showConfirmModal(type, msg, callback) {
            const modal = document.getElementById('actionConfirmModal');
            document.getElementById('confirmMessage').innerText = msg;
            const proceedBtn = document.getElementById('confirmProceedBtn');
            const icon = document.getElementById('confirmIcon');

            setBtnLoading(proceedBtn, false);

            if(type === 'approve') {
                proceedBtn.className = "btn-action btn-approve";
                proceedBtn.innerHTML = "<i class='fa-solid fa-check'></i> Setujui";
                icon.innerHTML = "<i class='fa-solid fa-circle-check icon-animated-check'></i>";
                icon.style.color = "";
            } else {
                proceedBtn.className = "btn-action btn-reject";
                proceedBtn.innerHTML = "<i class='fa-solid fa-xmark'></i> Hapus / Tolak";
                icon.innerHTML = "<i class='fa-solid fa-triangle-exclamation' style='font-size: 50px;'></i>";
                icon.style.color = "var(--danger)";
            }

            actionCallback = callback;
            modal.style.display = "flex";
        }

        function closeConfirmModal() {
            const proceedBtn = document.getElementById('confirmProceedBtn');
            setBtnLoading(proceedBtn, false);
            document.getElementById('actionConfirmModal').style.display = "none";
            actionCallback = null;
        }

        document.getElementById('confirmProceedBtn').addEventListener('click', async () => {
            if(actionCallback) {
                const proceedBtn = document.getElementById('confirmProceedBtn');
                setBtnLoading(proceedBtn, true, "Memproses...");
                try {
                    await actionCallback();
                } catch(e) {
                    console.error(e);
                } finally {
                    setBtnLoading(proceedBtn, false);
                    closeConfirmModal();
                }
            } else {
                closeConfirmModal();
            }
        });

        // Authentication API Logic
        async function processLogin() {
            const user = document.getElementById('login-username').value;
            const pass = document.getElementById('login-password').value;
            if(!user || !pass) return showToast("Username dan Password wajib diisi!", true);

            showLoader("Memeriksa Kredensial...");
            try {
                let res = await fetch(GAS_API_URL, {
                    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "login", username: user, password: pass })
                }).then(r => r.json());
                if(res.status === "success") {
                    localStorage.setItem('goBorneoAdminSession', JSON.stringify(res.user));
                    document.getElementById('view-auth').style.display = 'none';
                    document.getElementById('dashboard-wrapper').style.display = 'block';
                    
                    updateBranding(res.user);
                    
                    showLoader("Memuat Data Halaman...");
                    await fetchInitialDashboardData();
                    startRealtimePolling();
                    startMetricsAutoSlide();
                } else {
                    showToast(res.message, true);
                    showLoader("", false);
                }
            } catch (e) {
                showToast("Koneksi Error. Mengaktifkan mode simulasi...", true);
                setTimeout(() => {
                    document.getElementById('view-auth').style.display = 'none';
                    document.getElementById('dashboard-wrapper').style.display = 'block';
                    showLoader("", false); startRealtimePolling(); startMetricsAutoSlide();
                }, 1000);
            }
        }

        async function processRegister() {
            const nama = document.getElementById('reg-nama').value;
            const user = document.getElementById('reg-username').value;
            const email = document.getElementById('reg-email').value;
            const hp = document.getElementById('reg-hp').value;
            const perusahaan = document.getElementById('reg-perusahaan').value;
            const pass = document.getElementById('reg-password').value;
            const logoInput = document.getElementById('reg-logo');

            if(!nama || !user || !email || !hp || !perusahaan || !pass) return showToast("Seluruh formulir wajib diisi!", true);
            const pwdRegex = /^[A-Z](?=.*[a-zA-Z])(?=.*\d).{7,}$/;
            if(!pwdRegex.test(pass)) {
                return showToast("Format Password tidak sesuai standar keamanan!", true);
            }
            
            if(logoInput.files.length === 0) {
                return showToast("Logo Perusahaan wajib diunggah!", true);
            }
            
            let file = logoInput.files[0];
            if(file.size > 2 * 1024 * 1024) {
                return showToast("Ukuran logo maksimal 2MB!", true);
            }

            showLoader("Mendaftarkan Akun & Mengunggah Logo...");
            let base64Logo = await new Promise((resolve) => {
                let reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            try {
                let res = await fetch(GAS_API_URL, {
                    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ 
                        action: "register", namaLengkap: nama, username: user, 
                        email: email, noHp: hp, password: pass, role: "Admin",
                        namaPerusahaan: perusahaan, logoBase64: base64Logo
                    })
                }).then(r => r.json());
                showLoader("", false);
                if(res.status === "success") {
                    showToast("Registrasi Admin Berhasil! Silakan Login.");
                    toggleAuth('login');
                } else { showToast(res.message, true); }
            } catch (e) { 
                showToast("Gagal mendaftar, periksa koneksi.", true);
                showLoader("", false); 
            }
        }

        function navigateTo(pageId) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
            document.getElementById(`nav-${pageId}`).classList.add('active');
            document.getElementById(`view-${pageId}`).classList.add('active');
        }

        function switchRequestTab(tabId, el) {
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            if(el) el.classList.add('active');
            
            document.querySelectorAll('.tab-pane').forEach(pane => pane.style.display = 'none');
            document.getElementById(`tab-content-${tabId}`).style.display = 'block';
            
            filterRequests();
        }

        function filterRequests() {
            const keyword = document.getElementById('reqSearchInput').value.toLowerCase();
            const activePane = document.querySelector('.tab-pane[style*="block"]') || document.getElementById('tab-content-topup');
            const cards = activePane.querySelectorAll('.request-card');
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(keyword) ? "flex" : "none";
            });
        }
        
        function filterMitra() {
            const keyword = document.getElementById('mitraSearchInput').value.toLowerCase();
            const container = document.getElementById('container-mitra-list');
            const cards = container.querySelectorAll('.mitra-card');
            cards.forEach(card => {
                const text = card.innerText.toLowerCase();
                card.style.display = text.includes(keyword) ? "flex" : "none";
            });
        }

        async function onChartFilterChange() {
            currentChartFilter = document.getElementById('chartFilter').value;
            showLoader("Memperbarui Grafik...", true);
            
            try {
                let response = await fetch(GAS_API_URL, {
                    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "getAdminDashboardData", chartFilter: currentChartFilter })
                });
                let result = await response.json();
                if(result.status === "success") {
                    renderCharts(result.chartData);
                }
            } catch (error) {
                let mockChartData = {};
                if(currentChartFilter === 'hari') {
                    mockChartData = { labels: ['03 Jul', '04 Jul', '05 Jul', '06 Jul', '07 Jul'], values: [8, 15, 22, 19, 35] };
                } else if (currentChartFilter === 'bulan') {
                    mockChartData = { labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4'], values: [45, 60, 80, 55] };
                } else if (currentChartFilter === 'tahun') {
                    mockChartData = { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'], values: [120, 150, 180, 130, 200, 250, 220, 0, 0, 0, 0, 0] };
                }
                renderCharts(mockChartData);
            } finally {
                showLoader("", false);
            }
        }

        async function fetchInitialDashboardData() {
            try {
                let response = await fetch(GAS_API_URL, {
                    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "getAdminDashboardData", chartFilter: currentChartFilter })
                });
                let result = await response.json();
                if(result.status === "success") {
                    globalRawData = result;
                    updateNotificationBadges(result.requests);
                    renderMetrics(result.metrics);
                    renderCharts(result.chartData);
                    renderRequests(result.requests, result.history);
                    updateSettingsPreviews(result.settings);
                    
                    if (result.mitraList) {
                        globalMitraList = result.mitraList;
                        renderMitraList();
                    }
                }
            } catch (error) { console.error(error); } 
            finally { showLoader("", false); }
        }

        function startRealtimePolling() {
            if(pollingInterval) clearInterval(pollingInterval);
            pollingInterval = setInterval(async () => {
                try {
                    let response = await fetch(GAS_API_URL, {
                        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({ action: "getAdminDashboardData", chartFilter: currentChartFilter })
                    });
                    let result = await response.json();
                    if(result.status === "success") {
                        let newTopUp = result.requests && result.requests.topup ? result.requests.topup.length : 0;
                        let newSub = result.requests && result.requests.subscription ? result.requests.subscription.length : 0;
                        
                        if(newTopUp > lastTopUpCount) showToast("Terdapat antrean Top-Up Saldo baru!", false);
                        if(newSub > lastSubCount) showToast("Terdapat permintaan Langganan baru!", false);
                        
                        globalRawData = result;
                        updateNotificationBadges(result.requests);
                        renderMetrics(result.metrics);
                        renderCharts(result.chartData); 
                        renderRequests(result.requests, result.history);
                        updateSettingsPreviews(result.settings);
                        
                        if (result.mitraList) {
                            globalMitraList = result.mitraList;
                            renderMitraList();
                        }
                    }
                } catch(e) {}
            }, 10000);
        }

        function updateNotificationBadges(requests) {
            let topUpCount = requests && requests.topup ? requests.topup.length : 0;
            let subCount = requests && requests.subscription ? requests.subscription.length : 0;
            
            lastTopUpCount = topUpCount;
            lastSubCount = subCount;
            const badgeTopUp = document.getElementById('badge-topup');
            const badgeSub = document.getElementById('badge-sub');

            if(topUpCount > 0) {
                badgeTopUp.innerText = topUpCount;
                badgeTopUp.classList.add('show');
            } else { badgeTopUp.classList.remove('show'); }

            if(subCount > 0) {
                badgeSub.innerText = subCount;
                badgeSub.classList.add('show');
            } else { badgeSub.classList.remove('show'); }
        }

        function renderMetrics(metrics) {
            if(!metrics) return;
            document.getElementById('metric-mitra-bulanan').innerText = metrics.mitraBulanan || 0;
            document.getElementById('metric-mitra-komisi').innerText = metrics.mitraKomisi || 0;
            document.getElementById('metric-total-topup').innerText = "Rp " + formatNumber(metrics.totalTopUp || 0);
            document.getElementById('metric-total-sub').innerText = "Rp " + formatNumber(metrics.totalSubscription || 0);
        }

        function renderCharts(chartData) {
            const ctx = document.getElementById('bookingTrendChart').getContext('2d');
            let labels = chartData ? chartData.labels : ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
            let datasets = chartData ? chartData.values : [12, 19, 25, 15, 30, 45, 55];
            
            if (chartInstance) chartInstance.destroy();
            chartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Transaksi Sukses', data: datasets,
                        borderColor: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)',
                        borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: '#0369a1'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        function renderMitraList() {
            const container = document.getElementById('container-mitra-list');
            container.innerHTML = "";
            
            if(!globalMitraList || globalMitraList.length === 0) {
                container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:13px; font-weight:600;"><i class="fa-solid fa-users-slash" style="font-size:30px; margin-bottom:10px; display:block;"></i>Belum ada mitra yang terdaftar.</div>`;
                return;
            }

            globalMitraList.forEach((mitra, index) => {
                let logoSrc = mitra.logo || 'https://via.placeholder.com/150?text=Logo';
                let isLangganan = mitra.skema && mitra.skema.toLowerCase().includes('langganan');
                let skemaBadge = isLangganan ? 'badge-warning' : 'badge-success';
                let animDelay = (index * 0.1) + 's';
                
                container.innerHTML += `
                    <div class="mitra-card" onclick="openMitraDetail(${index})" style="animation-delay: ${animDelay};">
                        <div class="mitra-logo-wrapper">
                            <img src="${logoSrc}" class="mitra-logo" alt="Logo ${mitra.namaPerusahaan}" onerror="this.src='https://via.placeholder.com/150?text=Logo'">
                        </div>
                        <div class="mitra-card-content">
                            <h4>${mitra.namaPerusahaan}</h4>
                            <span class="badge ${skemaBadge}">${(mitra.skema || '-').toUpperCase()}</span>
                        </div>
                    </div>
                `;
            });
            filterMitra();
        }
        
        function openMitraDetail(index) {
            const mitra = globalMitraList[index];
            if(!mitra) return;
            
            document.getElementById('dtl-mitra-logo').src = mitra.logo || 'https://via.placeholder.com/150?text=Logo';
            document.getElementById('dtl-mitra-logo').onerror = function() { this.src = 'https://via.placeholder.com/150?text=Logo'; };
            document.getElementById('dtl-mitra-nama').innerText = mitra.namaPerusahaan;
            document.getElementById('dtl-mitra-skema').innerText = "Skema " + (mitra.skema || '-');
            
            document.getElementById('dtl-mitra-akun').innerText = mitra.username;
            document.getElementById('dtl-mitra-hp').innerText = mitra.noHp ? mitra.noHp.replace(/'/g, '') : '-';
            document.getElementById('dtl-mitra-alamat').innerText = mitra.alamat || '-';
            document.getElementById('dtl-mitra-armada').innerText = (mitra.totalArmada || 0) + " Unit";

            let isLangganan = mitra.skema && mitra.skema.toLowerCase().includes('langganan');
            if (isLangganan) {
                document.getElementById('dtl-label-saldo').innerHTML = '<i class="fa-solid fa-calendar-check"></i> Batas Langganan';
                document.getElementById('dtl-mitra-saldo').innerText = mitra.batasLangganan ? formatTanggalIndo(mitra.batasLangganan) : "Belum ada";
                document.getElementById('dtl-mitra-saldo').style.color = "var(--warning)";
                document.getElementById('dtl-mitra-skema').className = "badge badge-warning";
            } else {
                document.getElementById('dtl-label-saldo').innerHTML = '<i class="fa-solid fa-wallet"></i> Saldo Dompet';
                document.getElementById('dtl-mitra-saldo').innerText = "Rp " + formatNumber(mitra.saldo || 0);
                document.getElementById('dtl-mitra-saldo').style.color = "var(--success)";
                document.getElementById('dtl-mitra-skema').className = "badge badge-success";
            }

            document.getElementById('mitraDetailModal').style.display = "flex";
        }

        function closeMitraDetail() {
            document.getElementById('mitraDetailModal').style.display = "none";
        }

        function renderRequests(requests, history) {
            const containerTopUp = document.getElementById('container-topup-req');
            const containerSub = document.getElementById('container-sub-req');
            const containerHistTopUp = document.getElementById('container-hist-topup');
            const containerHistSub = document.getElementById('container-hist-sub');
            
            containerTopUp.innerHTML = ""; containerSub.innerHTML = "";
            containerHistTopUp.innerHTML = ""; containerHistSub.innerHTML = "";

            if(requests && requests.topup && requests.topup.length > 0) {
                requests.topup.forEach(item => {
                    containerTopUp.innerHTML += `
                        <div class="request-card">
                            <div class="request-header">
                                <div><h4 style="font-size:15px; font-weight:700;">${item.namaPerusahaan}</h4><span style="font-size:11px; color:var(--text-muted);">${formatTanggalIndo(item.tanggal)}</span></div>
                                <span class="badge badge-pending">PENDING</span>
                            </div>
                            <div style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px; font-size:13px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Nominal Top-Up:</span><strong style="color:var(--success);">Rp ${formatNumber(item.nominal)}</strong></div>
                            </div>
                            <button style="background:none; border:none; text-align:left; font-size:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="viewReceipt('${item.strukUrl}')"><i class="fa-solid fa-image"></i> Lihat Bukti Transfer</button>
                            <div class="action-buttons">
                                <button class="btn-action btn-reject" onclick="triggerAction('rejectTopUp', '${item.idRow || item.id}')"><i class="fa-solid fa-xmark"></i> Tolak</button>
                                <button class="btn-action btn-approve" onclick="triggerAction('approveTopUp', '${item.idRow || item.id}')"><i class="fa-solid fa-check"></i> Setujui</button>
                            </div>
                        </div>`;
                });
            } else { containerTopUp.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:13px; font-weight:600;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>Tidak ada antrean top-up.</div>`; }

            if(requests && requests.subscription && requests.subscription.length > 0) {
                requests.subscription.forEach(item => {
                    containerSub.innerHTML += `
                        <div class="request-card">
                            <div class="request-header">
                                <div><h4 style="font-size:15px; font-weight:700;">${item.namaPerusahaan}</h4><span style="font-size:11px; color:var(--text-muted);">${formatTanggalIndo(item.tanggal)}</span></div>
                                <span class="badge badge-pending">PENDING</span>
                            </div>
                            <div style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px; font-size:13px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total Bayar:</span><strong style="color:var(--primary-dark);">Rp ${formatNumber(item.totalBayar)}</strong></div>
                            </div>
                            <button style="background:none; border:none; text-align:left; font-size:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="viewReceipt('${item.strukUrl}')"><i class="fa-solid fa-image"></i> Lihat Bukti Transfer</button>
                            <div class="action-buttons">
                                <button class="btn-action btn-reject" onclick="triggerAction('rejectSub', '${item.idRow || item.id}')"><i class="fa-solid fa-xmark"></i> Tolak</button>
                                <button class="btn-action btn-approve" onclick="triggerAction('approveSub', '${item.idRow || item.id}')"><i class="fa-solid fa-check"></i> Setujui</button>
                            </div>
                        </div>`;
                });
            } else { containerSub.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:13px; font-weight:600;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>Tidak ada antrean langganan.</div>`; }

            if(history && history.topup && history.topup.length > 0) {
                history.topup.forEach(item => {
                    let bdg = item.status && item.status.toLowerCase() === "selesai" ? "badge-success" : "badge-danger";
                    containerHistTopUp.innerHTML += `
                        <div class="request-card">
                            <div class="request-header">
                                <div><h4 style="font-size:15px; font-weight:700;">${item.namaPerusahaan}</h4><span style="font-size:11px; color:var(--text-muted);">${formatTanggalIndo(item.tanggal)}</span></div>
                                <span class="badge ${bdg}">${(item.status || '-').toUpperCase()}</span>
                            </div>
                            <div style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px; font-size:13px;">
                                <div style="display:flex; justify-content:space-between;"><span>Nominal Top-Up:</span><strong style="color:var(--text-main);">Rp ${formatNumber(item.nominal)}</strong></div>
                            </div>
                            <button style="background:none; border:none; text-align:left; font-size:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="viewReceipt('${item.strukUrl}')"><i class="fa-solid fa-image"></i> Lihat Bukti Transfer</button>
                        </div>`;
                });
            } else { containerHistTopUp.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:13px; font-weight:600;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>Belum ada riwayat top-up.</div>`; }

            if(history && history.subscription && history.subscription.length > 0) {
                history.subscription.forEach(item => {
                    let bdg = item.status && item.status.toLowerCase() === "selesai" ? "badge-success" : "badge-danger";
                    containerHistSub.innerHTML += `
                        <div class="request-card">
                            <div class="request-header">
                                <div><h4 style="font-size:15px; font-weight:700;">${item.namaPerusahaan}</h4><span style="font-size:11px; color:var(--text-muted);">${formatTanggalIndo(item.tanggal)}</span></div>
                                <span class="badge ${bdg}">${(item.status || '-').toUpperCase()}</span>
                            </div>
                            <div style="background:rgba(0,0,0,0.03); padding:10px; border-radius:10px; font-size:13px;">
                                <div style="display:flex; justify-content:space-between;"><span>Total Bayar:</span><strong style="color:var(--text-main);">Rp ${formatNumber(item.totalBayar)}</strong></div>
                            </div>
                            <button style="background:none; border:none; text-align:left; font-size:12px; font-weight:700; color:var(--primary); cursor:pointer;" onclick="viewReceipt('${item.strukUrl}')"><i class="fa-solid fa-image"></i> Lihat Bukti Transfer</button>
                        </div>`;
                });
            } else { containerHistSub.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); font-size:13px; font-weight:600;"><i class="fa-regular fa-folder-open" style="font-size:30px; margin-bottom:10px; display:block;"></i>Belum ada riwayat langganan.</div>`; }
            
            filterRequests();
        }

        function triggerAction(actionType, rowId) {
            let label = actionType.includes("approve") ? "menyetujui" : "menolak";
            let type = actionType.includes("approve") ? "approve" : "reject";
            let tx = actionType.includes("TopUp") ? "Top-Up Saldo" : "Langganan";
            
            showConfirmModal(type, `Apakah Anda yakin ingin ${label} pengajuan ${tx} ini?`, async () => {
                await executeAction(actionType, rowId, tx);
            });
        }

        async function executeAction(actionType, rowId, txContext) {
            try {
                let res = await fetch(GAS_API_URL, {
                    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: actionType, idTarget: rowId })
                }).then(r => r.json());
                if(res.status === "success") { showToast("Sinkronisasi berhasil!"); await fetchInitialDashboardData(); } 
                else { showToast("Gagal: " + (res.message || "Aksi ditolak"), true); }
            } catch (error) { 
                showToast("Terjadi kesalahan jaringan.", true); 
            }
        }

        function viewReceipt(url) {
            if(!url || url === 'undefined' || url === "") return showToast("Tidak ada file struk.", true);
            document.getElementById('modalImgTarget').src = url;
            document.getElementById('imageModal').style.display = "flex";
        }
        function closeImageModal() { document.getElementById('imageModal').style.display = "none"; }

        // SETTINGS MODAL MANAGEMENT
        function updateSettingsPreviews(settings) {
            if(!settings) return;
            document.getElementById('preview-komisi').innerText = `Aktif: ${formatNumber(settings.komisi || 0)} %`;
            document.getElementById('preview-trial').innerText = `Aktif: ${settings.trialDuration || 0} Hari`;
            document.getElementById('preview-prefiks').innerText = `Aktif: ${settings.prefiksKode || '-'}`;
            document.getElementById('preview-rekening').innerText = `${settings.rekeningList ? settings.rekeningList.length : 0} Rekening Terdaftar`;
            document.getElementById('preview-kendaraan').innerText = `${settings.jenisKendaraanList ? settings.jenisKendaraanList.length : 0} Jenis Terdaftar`;
            document.getElementById('preview-fasilitas').innerText = `${settings.fasilitasList ? settings.fasilitasList.length : 0} Fasilitas Terdaftar`;
            document.getElementById('preview-paketakses').innerText = `${settings.paketAksesList ? settings.paketAksesList.length : 0} Paket Terdaftar`;
        }

        function openSettingModal(type) {
            const titleEl = document.getElementById('settingModalTitle');
            const bodyEl = document.getElementById('settingModalBody');
            const st = globalRawData.settings || {};
            
            if(type === 'admin') {
                const sessionStr = localStorage.getItem('goBorneoAdminSession') || "{}";
                const usr = JSON.parse(sessionStr);
                titleEl.innerHTML = '<i class="fa-solid fa-user-gear" style="color:var(--success);"></i> Edit Akun Admin';
                bodyEl.innerHTML = `
                    <label style="font-size:13px; font-weight:600;">Username (Tidak dapat diubah)</label>
                    <input type="text" id="edit-adm-user" class="form-control" value="${usr.username || ''}" disabled style="background:#e2e8f0; cursor:not-allowed;">
                    <label style="font-size:13px; font-weight:600; margin-top:10px; display:block;">Nama Lengkap</label>
                    <input type="text" id="edit-adm-nama" class="form-control" value="${usr.namaLengkap || ''}" placeholder="Nama Lengkap">
                    <label style="font-size:13px; font-weight:600; margin-top:10px; display:block;">Email</label>
                    <input type="email" id="edit-adm-email" class="form-control" value="${usr.email || ''}" placeholder="Email Admin">
                    <label style="font-size:13px; font-weight:600; margin-top:10px; display:block;">No Handphone</label>
                    <input type="text" id="edit-adm-hp" class="form-control" value="${usr.noHp || ''}" placeholder="08xxxx">
                    <label style="font-size:13px; font-weight:600; margin-top:10px; display:block;">Password Baru (Kosongkan jika tidak ubah)</label>
                    <input type="password" id="edit-adm-pass" class="form-control" placeholder="Password Baru">
                    <button class="btn-save-settings" style="background:var(--success);" onclick="saveAdminAccount(this)"><i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan Akun</button>
                `;
            } else if(type === 'komisi') {
                titleEl.innerHTML = '<i class="fa-solid fa-coins" style="color:var(--warning);"></i> Potongan Komisi';
                bodyEl.innerHTML = `
                    <label style="font-size:13px; font-weight:600;">Nominal Potongan per Transaksi (%)</label>
                    <input type="number" id="mod-komisi" class="form-control" value="${st.komisi || ''}" placeholder="Contoh: 5">
                    <button class="btn-save-settings" onclick="saveSingleSetting('komisi', this)"><i class="fa-solid fa-floppy-disk"></i> Simpan Komisi</button>
                `;
            } else if(type === 'trial') {
                titleEl.innerHTML = '<i class="fa-solid fa-hourglass-start" style="color:var(--primary);"></i> Masa Berlaku Trial';
                bodyEl.innerHTML = `
                    <label style="font-size:13px; font-weight:600;">Durasi Trial Pengguna Baru (Hari)</label>
                    <input type="number" id="mod-trial" class="form-control" value="${st.trialDuration || ''}" placeholder="Contoh: 7">
                    <button class="btn-save-settings" onclick="saveSingleSetting('trial', this)"><i class="fa-solid fa-floppy-disk"></i> Simpan Durasi Trial</button>
                `;
            } else if(type === 'kodepesanan') {
                titleEl.innerHTML = '<i class="fa-solid fa-barcode" style="color:#64748b;"></i> Prefiks Kode Booking';
                bodyEl.innerHTML = `
                    <label style="font-size:13px; font-weight:600;">Awalan Kode Booking / Invoice</label>
                    <input type="text" id="mod-prefiks" class="form-control" value="${st.prefiksKode || ''}" placeholder="Contoh: GB-">
                    <button class="btn-save-settings" onclick="saveSingleSetting('prefiks', this)"><i class="fa-solid fa-floppy-disk"></i> Simpan Prefiks</button>
                `;
            } else if(type === 'rekening') {
                titleEl.innerHTML = '<i class="fa-solid fa-building-columns" style="color:var(--success);"></i> Kelola Sheet Rekening';
                let listHtml = '';
                if(st.rekeningList && st.rekeningList.length > 0) {
                    st.rekeningList.forEach((rek, idx) => {
                        let logoSrc = rek.logo || rek.icon || 'https://via.placeholder.com/80?text=Bank';
                        listHtml += `
                            <div class="setting-list-item">
                                <div class="setting-item-content">
                                    <img src="${logoSrc}" class="setting-item-img" alt="Logo" onerror="this.src='https://via.placeholder.com/80?text=Bank'">
                                    <div>
                                        <strong style="display:block; font-size:14px;">${rek.bank} - ${rek.norek}</strong>
                                        <span style="font-size:11px; color:var(--text-muted);">${rek.atasNama}</span>
                                    </div>
                                </div>
                                <button class="btn-delete-item" onclick="deleteSettingItem('rekening', ${idx})"><i class="fa-solid fa-trash-can"></i></button>
                            </div>`;
                    });
                } else { listHtml = '<p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Belum ada data rekening.</p>'; }

                bodyEl.innerHTML = `
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px; padding-right:5px;">${listHtml}</div>
                    <hr style="border:none; border-top:1px dashed #cbd5e1; margin-bottom:15px;">
                    <h5 style="font-size:14px; margin-bottom:5px;">Tambah Rekening Baru</h5>
                    <input type="text" id="add-rek-bank" class="form-control" placeholder="Nama Bank (Ex: BCA)">
                    <input type="text" id="add-rek-norek" class="form-control" placeholder="Nomor Rekening">
                    <input type="text" id="add-rek-an" class="form-control" placeholder="Atas Nama">
                    <input type="text" id="add-rek-logo" class="form-control" placeholder="URL Logo Bank (Tersimpan di Kolom B)">
                    <button class="btn-save-settings" onclick="addSettingItem('rekening', this)" style="background:var(--success);"><i class="fa-solid fa-plus"></i> Tambah Rekening</button>
                `;
            } else if(type === 'kendaraan') {
                titleEl.innerHTML = '<i class="fa-solid fa-car" style="color:#a855f7;"></i> Kelola Sheet Jenis Kendaraan';
                let listHtml = '';
                if(st.jenisKendaraanList && st.jenisKendaraanList.length > 0) {
                    st.jenisKendaraanList.forEach((jns, idx) => {
                        let iconSrc = jns.icon || jns.logo || jns.gambar || 'https://via.placeholder.com/80?text=Car';
                        listHtml += `
                            <div class="setting-list-item">
                                <div class="setting-item-content">
                                     <img src="${iconSrc}" class="setting-item-img" alt="Icon" onerror="this.src='https://via.placeholder.com/80?text=Car'">
                                    <span style="font-size:14px; font-weight:700;">${jns.nama}</span>
                                </div>
                                <button class="btn-delete-item" onclick="deleteSettingItem('kendaraan', ${idx})"><i class="fa-solid fa-trash-can"></i></button>
                            </div>`;
                    });
                } else { listHtml = '<p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Belum ada data jenis kendaraan.</p>'; }

                bodyEl.innerHTML = `
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px; padding-right:5px;">${listHtml}</div>
                    <hr style="border:none; border-top:1px dashed #cbd5e1; margin-bottom:15px;">
                    <h5 style="font-size:14px; margin-bottom:5px;">Tambah Jenis Kendaraan</h5>
                    <input type="text" id="add-jns-nama" class="form-control" placeholder="Nama Jenis Kendaraan (Ex: Toyota Hiace)">
                    <input type="text" id="add-jns-icon" class="form-control" placeholder="URL Icon Gambar (Tersimpan di Kolom B)">
                    <button class="btn-save-settings" onclick="addSettingItem('kendaraan', this)" style="background:#a855f7;"><i class="fa-solid fa-plus"></i> Tambah Kendaraan</button>
                `;
            } else if(type === 'fasilitas') {
                titleEl.innerHTML = '<i class="fa-solid fa-star" style="color:#ec4899;"></i> Kelola Sheet Fasilitas';
                let listHtml = '';
                if(st.fasilitasList && st.fasilitasList.length > 0) {
                    st.fasilitasList.forEach((fas, idx) => {
                        let iconSrc = fas.icon || fas.logo || fas.gambar || 'https://via.placeholder.com/80?text=Star';
                        listHtml += `
                            <div class="setting-list-item">
                                <div class="setting-item-content">
                                    <img src="${iconSrc}" class="setting-item-img" alt="Icon" onerror="this.src='https://via.placeholder.com/80?text=Star'">
                                     <span style="font-size:14px; font-weight:700;">${fas.nama}</span>
                                </div>
                                <button class="btn-delete-item" onclick="deleteSettingItem('fasilitas', ${idx})"><i class="fa-solid fa-trash-can"></i></button>
                            </div>`;
                    });
                } else { listHtml = '<p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Belum ada data fasilitas.</p>'; }

                bodyEl.innerHTML = `
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px; padding-right:5px;">${listHtml}</div>
                    <hr style="border:none; border-top:1px dashed #cbd5e1; margin-bottom:15px;">
                    <h5 style="font-size:14px; margin-bottom:5px;">Tambah Fasilitas Baru</h5>
                    <input type="text" id="add-fas-nama" class="form-control" placeholder="Nama Fasilitas (Ex: AC, Reclining Seat)">
                    <input type="text" id="add-fas-icon" class="form-control" placeholder="URL Icon Gambar (Tersimpan di Kolom B)">
                    <button class="btn-save-settings" onclick="addSettingItem('fasilitas', this)" style="background:#ec4899;"><i class="fa-solid fa-plus"></i> Tambah Fasilitas</button>
                `;
            } else if(type === 'paketakses') {
                titleEl.innerHTML = '<i class="fa-solid fa-box" style="color:#f97316;"></i> Kelola Paket Akses';
                let listHtml = '';
                if(st.paketAksesList && st.paketAksesList.length > 0) {
                    st.paketAksesList.forEach((pkt, idx) => {
                        listHtml += `
                            <div class="setting-list-item">
                                <div class="setting-item-content">
                                    <div style="background:rgba(249,115,22,0.1); color:#f97316; width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                                        <i class="fa-solid fa-box" style="font-size: 18px;"></i>
                                    </div>
                                    <div>
                                        <strong style="display:block; font-size:14px;">${pkt.nama}</strong>
                                        <span style="font-size:11px; color:var(--text-muted);">Biaya: Rp ${formatNumber(pkt.harga)}</span>
                                    </div>
                                </div>
                                <button class="btn-delete-item" onclick="deleteSettingItem('paketakses', ${idx})"><i class="fa-solid fa-trash-can"></i></button>
                            </div>`;
                    });
                } else { listHtml = '<p style="font-size:12px; color:var(--text-muted); margin-bottom:15px;">Belum ada data paket akses.</p>'; }

                bodyEl.innerHTML = `
                    <div style="max-height:200px; overflow-y:auto; margin-bottom:15px; padding-right:5px;">${listHtml}</div>
                    <hr style="border:none; border-top:1px dashed #cbd5e1; margin-bottom:15px;">
                    <h5 style="font-size:14px; margin-bottom:5px;">Tambah Paket Akses Baru</h5>
                    <input type="text" id="add-paket-nama" class="form-control" placeholder="Waktu / Nama Paket (Ex: 1 Bulan)">
                    <input type="number" id="add-paket-harga" class="form-control" placeholder="Biaya (Ex: 50000)">
                    <button class="btn-save-settings" onclick="addSettingItem('paketakses', this)" style="background:#f97316;"><i class="fa-solid fa-plus"></i> Tambah Paket</button>
                `;
            }

            document.getElementById('settingInputModal').style.display = "flex";
        }

        function closeSettingModal() { 
            document.getElementById('settingInputModal').style.display = "none";
        }

        // SAVE & SETTING ACTIONS WITH INLINE BUTTON LOADING & COMPATIBLE GAS ACTIONS
        async function saveAdminAccount(btnEl) {
            const usr = document.getElementById('edit-adm-user').value;
            const nama = document.getElementById('edit-adm-nama').value;
            const email = document.getElementById('edit-adm-email').value;
            const hp = document.getElementById('edit-adm-hp').value;
            const pass = document.getElementById('edit-adm-pass').value;
            if(!nama || !email) return showToast("Nama dan Email wajib diisi!", true);

            setBtnLoading(btnEl, true, "Menyimpan...");
            try {
                let res = await fetch(GAS_API_URL, {
                    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({ action: "updateAdminAccount", username: usr, namaLengkap: nama, email: email, noHp: hp, password: pass })
                }).then(r => r.json());

                if(res.status === "success") {
                    let session = JSON.parse(localStorage.getItem('goBorneoAdminSession') || '{}');
                    session.namaLengkap = nama;
                    session.email = email;
                    session.noHp = hp;
                    localStorage.setItem('goBorneoAdminSession', JSON.stringify(session));
                    updateBranding(session);
                    showToast("Akun Admin berhasil diperbarui!");
                    closeSettingModal();
                    await fetchInitialDashboardData();
                } else {
                    showToast(res.message || "Gagal memperbarui akun.", true);
                }
            } catch(e) {
                showToast("Gagal memperbarui akun. Periksa koneksi internet.", true);
            } finally {
                setBtnLoading(btnEl, false);
            }
        }

        async function saveSingleSetting(type, btnEl) {
            let val = "";
            if(type === 'komisi') {
                val = document.getElementById('mod-komisi').value;
                if(val === "") return showToast("Nilai komisi tidak boleh kosong!", true);
            } else if(type === 'trial') {
                val = document.getElementById('mod-trial').value;
                if(val === "") return showToast("Nilai durasi trial tidak boleh kosong!", true);
            } else if(type === 'prefiks') {
                val = document.getElementById('mod-prefiks').value;
                if(val === "") return showToast("Prefiks tidak boleh kosong!", true);
            }

            setBtnLoading(btnEl, true, "Menyimpan...");
            try {
                let res = await fetch(GAS_API_URL, {
                    method: "POST", 
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "saveSetting",
                        settingType: type,
                        type: type,
                        value: val,
                        komisi: type === 'komisi' ? val : undefined,
                        trialDuration: type === 'trial' ? val : undefined,
                        prefiksKode: type === 'prefiks' ? val : undefined
                    })
                }).then(r => r.json());

                if(res.status === "success") {
                    showToast("Pengaturan berhasil disimpan!");
                    closeSettingModal();
                    await fetchInitialDashboardData();
                } else {
                    showToast(res.message || "Gagal menyimpan pengaturan.", true);
                }
            } catch(e) {
                showToast("Gagal terhubung ke server backend.", true);
            } finally {
                setBtnLoading(btnEl, false);
            }
        }

        async function addSettingItem(type, btnEl) {
            let itemData = {};
            if(type === 'rekening') {
                const bank = document.getElementById('add-rek-bank').value;
                const norek = document.getElementById('add-rek-norek').value;
                const atasNama = document.getElementById('add-rek-an').value;
                const logo = document.getElementById('add-rek-logo').value;
                if(!bank || !norek || !atasNama) return showToast("Semua bidang rekening wajib diisi!", true);
                itemData = { bank, norek, atasNama, logo };
            } else if(type === 'kendaraan') {
                const nama = document.getElementById('add-jns-nama').value;
                const icon = document.getElementById('add-jns-icon').value;
                if(!nama) return showToast("Nama kendaraan wajib diisi!", true);
                itemData = { nama, icon };
            } else if(type === 'fasilitas') {
                const nama = document.getElementById('add-fas-nama').value;
                const icon = document.getElementById('add-fas-icon').value;
                if(!nama) return showToast("Nama fasilitas wajib diisi!", true);
                itemData = { nama, icon };
            } else if(type === 'paketakses') {
                const nama = document.getElementById('add-paket-nama').value;
                const harga = document.getElementById('add-paket-harga').value;
                if(!nama || !harga) return showToast("Nama paket dan harga wajib diisi!", true);
                itemData = { nama, harga };
            }

            setBtnLoading(btnEl, true, "Menambahkan...");
            try {
                let res = await fetch(GAS_API_URL, {
                    method: "POST",
                    headers: { "Content-Type": "text/plain;charset=utf-8" },
                    body: JSON.stringify({
                        action: "addSettingItem",
                        type: type,
                        itemType: type,
                        data: itemData,
                        ...itemData
                    })
                }).then(r => r.json());

                if(res.status === "success") {
                    showToast("Data berhasil ditambahkan!");
                    closeSettingModal();
                    await fetchInitialDashboardData();
                } else {
                    showToast(res.message || "Gagal menambahkan data.", true);
                }
            } catch(e) {
                showToast("Gagal menyimpan data ke server.", true);
            } finally {
                setBtnLoading(btnEl, false);
            }
        }

        function deleteSettingItem(type, index) {
            showConfirmModal('reject', `Apakah Anda yakin ingin menghapus data ${type} ini?`, async () => {
                try {
                    let res = await fetch(GAS_API_URL, {
                        method: "POST",
                        headers: { "Content-Type": "text/plain;charset=utf-8" },
                        body: JSON.stringify({
                            action: "deleteSettingItem",
                            type: type,
                            itemType: type,
                            index: index
                        })
                    }).then(r => r.json());

                    if(res.status === "success") {
                        showToast("Data berhasil dihapus!");
                        closeSettingModal();
                        await fetchInitialDashboardData();
                    } else {
                        showToast(res.message || "Gagal menghapus data.", true);
                    }
                } catch(e) {
                    showToast("Gagal menghapus data dari server.", true);
                }
            });
        }

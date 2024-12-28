console.log('XLSX library loaded:', typeof XLSX !== 'undefined');

window.sampleData = {};  // Initialize as empty object

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getWeekNumber(date) {
    // Create a copy of the date to avoid modifying the original
    const d = new Date(date);
    
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    
    // Get first day of year
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    
    // Calculate week number
    const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    
    // Return string in format "YYYY-WXX"
    return `${d.getUTCFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
}

document.getElementById('importBtn').addEventListener('click', function() {
    console.log('Import button clicked');
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        alert('Please select a file first!');
        return;
    }

    console.log('File selected:', file.name);
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(worksheet, { 
                header: 1,
                raw: true,
                defval: null
            });
            
            const previewData = [];
            
            // Process rows 4-34 (array indices 3-33)
            for (let i = 3; i <= 33; i++) {
                const row = rows[i];
                if (!row) continue;
                
                const unitType = row[0];  // Column A
                const weeklyTotal = row[9];  // Changed to column J (index 9)
                
                console.log(`Processing ${unitType}:`, {
                    weeklyTotal,
                    fullRow: row
                });
                
                if (unitType && weeklyTotal > 0) {
                    const option = document.querySelector(`#unitType option[value="${unitType}"]`);
                    if (option) {
                        const rate = parseFloat(option.getAttribute('data-rate'));
                        previewData.push({
                            unitType: unitType,
                            weeklyTotal: parseFloat(weeklyTotal),
                            ratePerUnit: rate
                        });
                        console.log('Added to preview:', {
                            unitType,
                            weeklyTotal,
                            rate
                        });
                    }
                }
            }
            
            if (previewData.length === 0) {
                alert('No valid data found in the Excel file. Check console for details.');
            } else {
                showImportPreview(previewData);
            }
        } catch (error) {
            console.error('Error reading Excel file:', error);
            alert('Error reading Excel file: ' + error.message);
        }
    };
    
    reader.readAsArrayBuffer(file);
});

function showImportPreview(previewData) {
    // Get this Sunday and next Saturday
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay()); // Go back to Sunday
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6); // Go forward to Saturday

    // Format dates for display and value
    const formatDateForDisplay = (date) => {
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
    };
    const formatDateForValue = (date) => {
        return date.toISOString().split('T')[0];
    };

    let html = `
        <div class="modal-overlay">
            <div class="modal-content">
                <h2>Import Preview</h2>
                
                <div class="form-group">
                    <label for="importDate">Select Week:</label>
                    <select id="importDate" required>
                        ${generateWeekOptions()}
                    </select>
                    <div class="week-range" id="weekRange">
                        ${formatDateForDisplay(sunday)} - ${formatDateForDisplay(saturday)}
                    </div>
                </div>

                <div class="preview-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Unit Type</th>
                                <th>Weekly Total</th>
                                <th>Rate</th>
                                <th>Weekly Earnings</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${previewData.map(row => `
                                <tr>
                                    <td>${row.unitType}</td>
                                    <td>${row.weeklyTotal}</td>
                                    <td>$${row.ratePerUnit.toFixed(2)}</td>
                                    <td>$${(row.weeklyTotal * row.ratePerUnit).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="modal-actions">
                    <button onclick="confirmImport('${encodeURIComponent(JSON.stringify(previewData))}')">Import Data</button>
                    <button class="cancel-btn" onclick="closeImportPreview()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', html);

    // Add event listener to update week range when selection changes
    document.getElementById('importDate').addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const selectedSunday = new Date(selectedDate);
        selectedSunday.setDate(selectedDate.getDate() - selectedDate.getDay());
        const selectedSaturday = new Date(selectedSunday);
        selectedSaturday.setDate(selectedSunday.getDate() + 6);
        
        document.getElementById('weekRange').textContent = 
            `${formatDateForDisplay(selectedSunday)} - ${formatDateForDisplay(selectedSaturday)}`;
    });
}

// Helper function to generate week options
function generateWeekOptions() {
    const options = [];
    const today = new Date();
    const startDate = new Date(today);
    startDate.setMonth(startDate.getMonth() - 2); // Show past 2 months

    // Go to first Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate options for each week
    for (let date = new Date(startDate); date <= today; date.setDate(date.getDate() + 7)) {
        const sunday = new Date(date);
        const saturday = new Date(date);
        saturday.setDate(sunday.getDate() + 6);
        
        const formatDate = d => `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`;
        const value = sunday.toISOString().split('T')[0];
        const display = `${formatDate(sunday)} - ${formatDate(saturday)}`;
        
        options.push(`<option value="${value}">${display}</option>`);
    }

    return options.join('');
}

window.confirmImport = function(encodedData) {
    const data = JSON.parse(decodeURIComponent(encodedData));
    const selectedDate = document.getElementById('importDate').value;
    
    const weekKey = getWeekNumber(new Date(selectedDate));
    
    if (!window.sampleData[weekKey]) {
        window.sampleData[weekKey] = [];
    }
    
    data.forEach(entry => {
        window.sampleData[weekKey].push({
            date: selectedDate,
            unitType: entry.unitType,
            units: entry.weeklyTotal,
            ratePerUnit: entry.ratePerUnit,
            notes: `Imported from Excel`
        });
    });

    // Save data
    localStorage.setItem('productionData', JSON.stringify(window.sampleData));
    
    // Close the preview modal
    closeImportPreview();
    
    // Update displays
    document.getElementById('weekSelect').value = weekKey;
    updateDisplay();
    updateWeeksList();
    
    alert('Data imported successfully!');
};

window.closeImportPreview = function() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
};

window.updateDisplay = function() {
    const selectedWeek = document.getElementById('weekSelect').value;
    const weekData = window.sampleData[selectedWeek] || [];
    
    // Clear existing data
    const productionData = document.getElementById('productionData');
    productionData.innerHTML = '';
    
    let totalUnits = 0;
    let totalEarnings = 0;
    
    // Create unit type summary
    const unitSummary = {};
    
    // Populate table with data and collect summary
    weekData.forEach((entry, index) => {
        const dailyEarnings = entry.units * entry.ratePerUnit;
        totalUnits += entry.units;
        totalEarnings += dailyEarnings;

        // Add to unit summary
        if (!unitSummary[entry.unitType]) {
            unitSummary[entry.unitType] = {
                units: 0,
                earnings: 0
            };
        }
        unitSummary[entry.unitType].units += entry.units;
        unitSummary[entry.unitType].earnings += dailyEarnings;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(entry.date)}</td>
            <td>${entry.unitType}</td>
            <td>${entry.units}</td>
            <td>$${entry.ratePerUnit.toFixed(2)}</td>
            <td>$${dailyEarnings.toFixed(2)}</td>
            <td>${entry.notes || ''}</td>
            <td class="actions-cell">
                <button class="edit-btn" onclick="editEntry(${index})">Edit</button>
                <button class="delete-btn" onclick="deleteEntry(${index})">Delete</button>
            </td>
        `;
        productionData.appendChild(row);
    });

    // Add summary section
    if (Object.keys(unitSummary).length > 0) {
        // Add separator row
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = `
            <td colspan="7" style="background: var(--gradient); height: 2px; padding: 0;"></td>
        `;
        productionData.appendChild(separatorRow);

        // Add summary for each unit type
        Object.entries(unitSummary).forEach(([unitType, data]) => {
            const summaryRow = document.createElement('tr');
            summaryRow.classList.add('summary-row');
            summaryRow.innerHTML = `
                <td colspan="2"><strong>${unitType} Total:</strong></td>
                <td><strong>${data.units}</strong></td>
                <td></td>
                <td><strong>$${data.earnings.toFixed(2)}</strong></td>
                <td colspan="2"></td>
            `;
            productionData.appendChild(summaryRow);
        });

        // Add final total row
        const totalRow = document.createElement('tr');
        totalRow.classList.add('total-row');
        totalRow.innerHTML = `
            <td colspan="2"><strong>Week Total:</strong></td>
            <td><strong>${totalUnits}</strong></td>
            <td></td>
            <td><strong>$${totalEarnings.toFixed(2)}</strong></td>
            <td colspan="2"></td>
        `;
        productionData.appendChild(totalRow);

        // Add average daily stats
        const daysWithData = weekData.length || 1;
        const avgUnits = (totalUnits / daysWithData).toFixed(1);
        const avgEarnings = (totalEarnings / daysWithData).toFixed(2);

        const statsRow = document.createElement('tr');
        statsRow.classList.add('stats-row');
        statsRow.innerHTML = `
            <td colspan="2"><strong>Daily Averages:</strong></td>
            <td><strong>${avgUnits}</strong></td>
            <td></td>
            <td><strong>$${avgEarnings}</strong></td>
            <td colspan="2"></td>
        `;
        productionData.appendChild(statsRow);
    }
};

// Add this function to format the week selector options
function updateWeekSelector() {
    const weekSelect = document.getElementById('weekSelect');
    const currentValue = weekSelect.value;
    
    // Get all available weeks from sampleData
    const weeks = Object.keys(window.sampleData).sort();
    
    // Create a datalist for the week selector
    let datalistHtml = `<datalist id="weekOptions">`;
    weeks.forEach(week => {
        const dateRange = getWeekDateRange(week);
        datalistHtml += `<option value="${week}" label="${dateRange}">`;
    });
    datalistHtml += `</datalist>`;
    
    // Add the datalist to the page
    document.body.insertAdjacentHTML('beforeend', datalistHtml);
    
    // Update the week selector
    weekSelect.setAttribute('list', 'weekOptions');
    
    // Add a custom label to show the date range
    const weekLabel = document.createElement('span');
    weekLabel.id = 'weekLabel';
    weekLabel.className = 'week-label';
    weekSelect.parentNode.insertBefore(weekLabel, weekSelect.nextSibling);
    
    // Update the label when week changes
    weekSelect.addEventListener('change', function() {
        const dateRange = getWeekDateRange(this.value);
        weekLabel.textContent = dateRange;
    });
    
    // Set initial label
    if (currentValue) {
        weekLabel.textContent = getWeekDateRange(currentValue);
    }
}

// Update the DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', function() {
    // Load saved data first
    const savedData = localStorage.getItem('productionData');
    if (savedData) {
        try {
            // Parse saved data and update sampleData
            window.sampleData = JSON.parse(savedData);
            console.log('Loaded saved data:', window.sampleData);
        } catch (error) {
            console.error('Error loading saved data:', error);
            window.sampleData = {};  // Reset to empty if error
        }
    } else {
        window.sampleData = {};  // Initialize as empty if no saved data
    }
    
    // Set default date to today
    document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    
    // Set default week to current week
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    document.getElementById('weekSelect').value = currentWeek;
    
    // Update the week selector
    updateWeekSelector();
    
    // Update displays
    updateDisplay();
    updateWeeksList();
    
    // Add form submission handler
    document.getElementById('productionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const entryDate = document.getElementById('entryDate').value;
        const unitType = document.getElementById('unitType').value;
        const units = parseFloat(document.getElementById('unitsCompleted').value);
        const ratePerUnit = parseFloat(document.getElementById('ratePerUnit').value);
        const notes = document.getElementById('notes').value;
        
        // Get week number from date
        const weekKey = getWeekNumber(new Date(entryDate));
        
        // Initialize week if it doesn't exist
        if (!window.sampleData[weekKey]) {
            window.sampleData[weekKey] = [];
        }
        
        // Add new entry
        window.sampleData[weekKey].push({
            date: entryDate,
            unitType: unitType,
            units: units,
            ratePerUnit: ratePerUnit,
            notes: notes
        });
        
        // Save data
        localStorage.setItem('productionData', JSON.stringify(window.sampleData));
        
        // Update displays
        document.getElementById('weekSelect').value = weekKey;
        updateDisplay();
        updateWeeksList();
        
        // Reset form
        this.reset();
        
        // Set today's date again
        document.getElementById('entryDate').value = new Date().toISOString().split('T')[0];
    });

    // Add this to your DOMContentLoaded event listener
    document.getElementById('unitType').addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const rate = selectedOption.getAttribute('data-rate');
        if (rate) {
            document.getElementById('ratePerUnit').value = rate;
        }
    });

    // Add this to your DOMContentLoaded event listener
    document.getElementById('unitsCompleted').addEventListener('input', function() {
        const units = parseFloat(this.value) || 0;
        const rate = parseFloat(document.getElementById('ratePerUnit').value) || 0;
        const earnings = units * rate;
        
        // Add or update the earnings display
        let earningsDisplay = document.getElementById('earningsPreview');
        if (!earningsDisplay) {
            earningsDisplay = document.createElement('div');
            earningsDisplay.id = 'earningsPreview';
            earningsDisplay.className = 'earnings-preview';
            this.parentNode.appendChild(earningsDisplay);
        }
        earningsDisplay.textContent = `Earnings: $${earnings.toFixed(2)}`;
    });

    // Update pay period display
    updatePayPeriodDisplay();

    // Add search handler
    document.getElementById('weekSearch').addEventListener('input', function() {
        updateWeeksList();
    });
});

document.getElementById('saveWeekBtn').addEventListener('click', function() {
    const selectedWeek = document.getElementById('weekSelect').value;
    const weekData = window.sampleData[selectedWeek];
    
    if (!weekData || weekData.length === 0) {
        alert('No data to save for this week');
        return;
    }

    try {
        // Save to localStorage
        localStorage.setItem('productionData', JSON.stringify(window.sampleData));
        
        // Update weeks list
        updateWeeksList();
        
        alert('Week saved successfully!');
    } catch (error) {
        console.error('Error saving week:', error);
        alert('Error saving week: ' + error.message);
    }
});

function updateWeeksList() {
    const weeksList = document.getElementById('weeksList');
    const searchTerm = document.getElementById('weekSearch').value.toLowerCase();
    weeksList.innerHTML = '';
    
    // Get all weeks that have data
    const weeks = Object.entries(window.sampleData)
        .filter(([week, data]) => data && data.length > 0)
        .sort((a, b) => {
            // Sort by date (oldest first)
            const dateA = new Date(a[1][0].date);
            const dateB = new Date(b[1][0].date);
            return dateA - dateB;
        });
    
    weeks.forEach(([week, data]) => {
        // Calculate week totals
        const totals = data.reduce((acc, entry) => {
            acc.units += entry.units;
            acc.earnings += entry.units * entry.ratePerUnit;
            return acc;
        }, { units: 0, earnings: 0 });
        
        // Get date range for the week
        const dateRange = getWeekDateRange(week);
        
        // Check if this week matches the search term
        if (searchTerm && !dateRange.toLowerCase().includes(searchTerm)) {
            return; // Skip this week if it doesn't match the search
        }
        
        const weekItem = document.createElement('div');
        weekItem.className = 'week-item';
        if (week === document.getElementById('weekSelect').value) {
            weekItem.classList.add('active');
        }
        
        weekItem.innerHTML = `
            <div class="week-header">
                <div>${dateRange}</div>
                <button class="delete-week-btn" onclick="deleteWeek('${week}')">×</button>
            </div>
            <div class="week-total">
                Units: ${totals.units}<br>
                Earnings: $${totals.earnings.toFixed(2)}
            </div>
        `;
        
        weekItem.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-week-btn')) return;
            
            document.getElementById('weekSelect').value = week;
            updateDisplay();
            
            document.querySelectorAll('.week-item').forEach(item => {
                item.classList.remove('active');
            });
            weekItem.classList.add('active');
        });
        
        weeksList.appendChild(weekItem);
    });
}

// Add this function to get the date range for a week
function getWeekDateRange(weekString) {
    // Parse the week string (format: "YYYY-WXX")
    const year = parseInt(weekString.split('-')[0]);
    const week = parseInt(weekString.split('W')[1]);
    
    // Get the first day of the year
    const firstDayOfYear = new Date(year, 0, 1);
    
    // Get to the first day of the week (Sunday)
    const firstDayOfWeek = new Date(firstDayOfYear);
    firstDayOfWeek.setDate(firstDayOfYear.getDate() + (week - 1) * 7);
    while (firstDayOfWeek.getDay() !== 0) {
        firstDayOfWeek.setDate(firstDayOfWeek.getDate() - 1);
    }
    
    // Get the last day of the week (Saturday)
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
    
    // Format the dates
    const formatDate = (date) => {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const year = date.getFullYear().toString().slice(2);
        return `${month}/${day}/${year}`;
    };
    
    return `${formatDate(firstDayOfWeek)} - ${formatDate(lastDayOfWeek)}`;
}

// Update the deleteWeek function
window.deleteWeek = function(weekKey) {
    if (confirm('Are you sure you want to delete this entire week?')) {
        try {
            // Delete the week from sampleData
            delete window.sampleData[weekKey];
            
            // Save to localStorage immediately
            localStorage.setItem('productionData', JSON.stringify(window.sampleData));
            
            // Update displays
            updateWeeksList();
            
            // If the deleted week was the currently selected week, reset the display
            const currentWeek = document.getElementById('weekSelect').value;
            if (currentWeek === weekKey) {
                // Set to current week
                const now = new Date();
                const newWeek = getWeekNumber(now);
                document.getElementById('weekSelect').value = newWeek;
            }
            
            updateDisplay();
            
            console.log('Week deleted. Current data:', window.sampleData);
            
        } catch (error) {
            console.error('Error during week deletion:', error);
            alert('Error deleting week: ' + error.message);
        }
    }
};

// Add this function to handle deleting entries
window.deleteEntry = function(index) {
    const selectedWeek = document.getElementById('weekSelect').value;
    
    if (confirm('Are you sure you want to delete this entry?')) {
        // Remove the entry from the array
        if (window.sampleData[selectedWeek]) {
            window.sampleData[selectedWeek].splice(index, 1);
            
            // If week is empty, remove it
            if (window.sampleData[selectedWeek].length === 0) {
                delete window.sampleData[selectedWeek];
            }
            
            // Save the updated data
            localStorage.setItem('productionData', JSON.stringify(window.sampleData));
            
            // Update displays
            updateDisplay();
            updateWeeksList();
        }
    }
};

// Also add the editEntry function while we're at it
window.editEntry = function(index) {
    const selectedWeek = document.getElementById('weekSelect').value;
    const entry = window.sampleData[selectedWeek][index];
    
    // Fill the form with the entry's data
    document.getElementById('entryDate').value = entry.date;
    document.getElementById('unitType').value = entry.unitType;
    document.getElementById('unitsCompleted').value = entry.units;
    document.getElementById('ratePerUnit').value = entry.ratePerUnit;
    document.getElementById('notes').value = entry.notes || '';
    
    // Remove the old entry
    deleteEntry(index);
    
    // Scroll to the form
    document.querySelector('.entry-form').scrollIntoView({ behavior: 'smooth' });
};

// Add these functions for pay period handling
function getPayPeriodDates(date = new Date()) {
    // Define exact pay periods
    const payPeriods = [
        {
            startDate: new Date(2024, 9, 27),  // October 27, 2024
            endDate: new Date(2024, 10, 9),    // November 9, 2024
            payDate: new Date(2024, 10, 28)    // November 28, 2024
        },
        {
            startDate: new Date(2024, 10, 10), // November 10, 2024
            endDate: new Date(2024, 10, 23),   // November 23, 2024
            payDate: new Date(2024, 11, 12)    // December 12, 2024
        },
        {
            startDate: new Date(2024, 10, 24), // November 24, 2024
            endDate: new Date(2024, 11, 7),    // December 7, 2024
            payDate: new Date(2024, 11, 26)    // December 26, 2024
        }
    ];
    
    // Find the current pay period
    const currentDate = new Date(date);
    
    // Find current and next periods
    let currentPeriod = null;
    let upcomingPeriod = null;
    
    for (let i = 0; i < payPeriods.length; i++) {
        if (currentDate >= payPeriods[i].startDate && currentDate <= payPeriods[i].payDate) {
            currentPeriod = payPeriods[i];
            upcomingPeriod = payPeriods[i + 1] || null;
            break;
        }
    }
    
    return {
        current: currentPeriod || payPeriods[0],
        upcoming: upcomingPeriod || payPeriods[1]
    };
}

function updatePayPeriodDisplay() {
    const periods = getPayPeriodDates();
    const formatDate = date => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear().toString().slice(2)}`;
    
    // Calculate totals for current period
    let currentTotal = 0;
    let upcomingTotal = 0;
    
    Object.entries(window.sampleData).forEach(([week, entries]) => {
        entries.forEach(entry => {
            const entryDate = new Date(entry.date);
            if (entryDate >= periods.current.startDate && entryDate <= periods.current.endDate) {
                currentTotal += entry.units * entry.ratePerUnit;
            } else if (periods.upcoming && entryDate >= periods.upcoming.startDate && entryDate <= periods.upcoming.endDate) {
                upcomingTotal += entry.units * entry.ratePerUnit;
            }
        });
    });
    
    // Update current period display
    document.getElementById('currentPayPeriod').innerHTML = `
        <div class="work-period">
            <div>Work Period:<br>${formatDate(periods.current.startDate)} - ${formatDate(periods.current.endDate)}</div>
        </div>
        <div class="pay-date">Pay Date: ${formatDate(periods.current.payDate)}</div>
    `;
    
    document.getElementById('payPeriodTotal').innerHTML = `
        Period Earnings: $${currentTotal.toFixed(2)}
    `;
    
    // Update upcoming period display
    if (periods.upcoming) {
        document.getElementById('upcomingPayPeriod').innerHTML = `
            <div class="work-period">
                <div>Work Period:<br>${formatDate(periods.upcoming.startDate)} - ${formatDate(periods.upcoming.endDate)}</div>
            </div>
            <div class="pay-date">Pay Date: ${formatDate(periods.upcoming.payDate)}</div>
        `;
        
        document.getElementById('upcomingPayPeriodTotal').innerHTML = `
            Period Earnings: $${upcomingTotal.toFixed(2)}
        `;
    }
}

// Update the updateDisplay function to also update pay period
const originalUpdateDisplay = window.updateDisplay;
window.updateDisplay = function() {
    originalUpdateDisplay();
    updatePayPeriodDisplay();
}; 
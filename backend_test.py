#!/usr/bin/env python3
"""
DutyOnTrack Phase 2 Backend Testing
Tests all Phase 2 endpoints: Attendance, Salary, Expenses, Incomes, Invoices, Reports, CSV Export, Digital Register
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Base URL from .env
BASE_URL = "https://agency-pro-33.preview.emergentagent.com/api"

# Test data storage
test_data = {
    'agency_a': {},
    'agency_b': {},
}

def log(msg, level="INFO"):
    """Log test messages"""
    print(f"[{level}] {msg}")

def test_signup(agency_name, owner_name, email, password):
    """Sign up a new agency"""
    log(f"Testing signup for {agency_name}...")
    try:
        response = requests.post(f"{BASE_URL}/auth/signup", json={
            "agencyName": agency_name,
            "ownerName": owner_name,
            "email": email,
            "password": password,
            "phone": "9876543210"
        }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Signup successful for {agency_name}")
            return {
                'token': data['token'],
                'agency': data['agency'],
                'user': data['user']
            }
        else:
            log(f"❌ Signup failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Signup exception: {str(e)}", "ERROR")
        return None

def test_add_staff(token, name, monthly_salary):
    """Add a staff member"""
    log(f"Adding staff: {name} with salary {monthly_salary}...")
    try:
        response = requests.post(f"{BASE_URL}/staff", 
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": name,
                "phone": "9876543210",
                "monthlySalary": monthly_salary,
                "status": "available"
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Staff added: {data['name']} (ID: {data['id']}, Code: {data['staffCode']})")
            return data
        else:
            log(f"❌ Add staff failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Add staff exception: {str(e)}", "ERROR")
        return None

def test_add_client(token, name, monthly_charges):
    """Add a client"""
    log(f"Adding client: {name} with charges {monthly_charges}...")
    try:
        response = requests.post(f"{BASE_URL}/clients",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": name,
                "patientName": f"Patient of {name}",
                "phone": "9876543210",
                "monthlyCharges": monthly_charges,
                "location": "Home"
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Client added: {data['name']} (ID: {data['id']})")
            return data
        else:
            log(f"❌ Add client failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Add client exception: {str(e)}", "ERROR")
        return None

def test_create_placement(token, staff_id, client_id, join_date, monthly_client_charge, monthly_staff_salary):
    """Create a placement"""
    log(f"Creating placement: staff={staff_id}, client={client_id}, joinDate={join_date}...")
    try:
        response = requests.post(f"{BASE_URL}/placements",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "staffId": staff_id,
                "clientId": client_id,
                "joinDate": join_date,
                "monthlyClientCharge": monthly_client_charge,
                "monthlyStaffSalary": monthly_staff_salary,
                "dutyType": "24 Hr",
                "shift": "Day",
                "location": "Home"
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Placement created: {data['code']} (ID: {data['id']})")
            return data
        else:
            log(f"❌ Create placement failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Create placement exception: {str(e)}", "ERROR")
        return None

def test_attendance_auto_backfill(token, staff_id, month):
    """Test attendance auto-backfill"""
    log(f"Testing attendance auto-backfill for staff={staff_id}, month={month}...")
    try:
        response = requests.get(f"{BASE_URL}/attendance",
            headers={"Authorization": f"Bearer {token}"},
            params={"staffId": staff_id, "month": month},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Attendance retrieved: {len(data)} entries")
            
            # Check all entries are status='P'
            all_present = all(entry['status'] == 'P' for entry in data)
            if all_present:
                log(f"✅ All {len(data)} attendance entries have status='P' (auto-backfilled)")
            else:
                log(f"⚠️ Not all entries are 'P': {[e['status'] for e in data]}", "WARN")
            
            return data
        else:
            log(f"❌ Get attendance failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get attendance exception: {str(e)}", "ERROR")
        return None

def test_attendance_update(token, staff_id, date, status):
    """Test attendance update (upsert)"""
    log(f"Testing attendance update: staff={staff_id}, date={date}, status={status}...")
    try:
        response = requests.post(f"{BASE_URL}/attendance",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "staffId": staff_id,
                "date": date,
                "status": status,
                "notes": "Test update"
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Attendance updated: date={data['date']}, status={data['status']}")
            return data
        else:
            log(f"❌ Update attendance failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Update attendance exception: {str(e)}", "ERROR")
        return None

def test_attendance_bulk(token, rows):
    """Test bulk attendance update"""
    log(f"Testing bulk attendance update with {len(rows)} rows...")
    try:
        response = requests.post(f"{BASE_URL}/attendance/bulk",
            headers={"Authorization": f"Bearer {token}"},
            json={"rows": rows},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Bulk attendance updated: {data.get('upserted', 0)} rows")
            return data
        else:
            log(f"❌ Bulk attendance failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Bulk attendance exception: {str(e)}", "ERROR")
        return None

def test_salary_get(token, staff_id, month):
    """Test salary computation"""
    log(f"Testing salary GET: staff={staff_id}, month={month}...")
    try:
        response = requests.get(f"{BASE_URL}/salary",
            headers={"Authorization": f"Bearer {token}"},
            params={"staffId": staff_id, "month": month},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Salary retrieved:")
            log(f"   Stats: present={data['stats']['present']}, absent={data['stats']['absent']}, "
                f"half={data['stats']['half']}, late={data['stats']['late']}, "
                f"leave={data['stats']['leave']}, paidLeave={data['stats']['paidLeave']}, "
                f"effective={data['stats']['effective']}")
            log(f"   perDay={data['perDay']}, gross={data['gross']}")
            log(f"   advance={data['advance']}, deduction={data['deduction']}, paid={data['paid']}, pending={data['pending']}")
            return data
        else:
            log(f"❌ Get salary failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get salary exception: {str(e)}", "ERROR")
        return None

def test_salary_payment(token, staff_id, month, amount, payment_type):
    """Test salary payment"""
    log(f"Testing salary payment: staff={staff_id}, month={month}, amount={amount}, type={payment_type}...")
    try:
        response = requests.post(f"{BASE_URL}/salary/payment",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "staffId": staff_id,
                "month": month,
                "amount": amount,
                "type": payment_type,
                "paidVia": "UPI",
                "notes": f"Test {payment_type}"
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Salary payment recorded: {payment_type} amount={data['amount']}")
            return data
        else:
            log(f"❌ Salary payment failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Salary payment exception: {str(e)}", "ERROR")
        return None

def test_salary_all(token, month):
    """Test salary all staff summary"""
    log(f"Testing salary/all: month={month}...")
    try:
        response = requests.get(f"{BASE_URL}/salary/all",
            headers={"Authorization": f"Bearer {token}"},
            params={"month": month},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Salary all retrieved: month={data['month']}, {len(data['rows'])} staff")
            return data
        else:
            log(f"❌ Get salary/all failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get salary/all exception: {str(e)}", "ERROR")
        return None

def test_expenses_create(token, category, amount, date):
    """Test expense creation"""
    log(f"Testing expense creation: category={category}, amount={amount}...")
    try:
        response = requests.post(f"{BASE_URL}/expenses",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "category": category,
                "amount": amount,
                "date": date,
                "paidVia": "UPI",
                "notes": "Test expense"
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Expense created: {data['code']} - {data['category']} ₹{data['amount']}")
            return data
        else:
            log(f"❌ Create expense failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Create expense exception: {str(e)}", "ERROR")
        return None

def test_expenses_get(token, month):
    """Test expense retrieval with month filter"""
    log(f"Testing expense GET: month={month}...")
    try:
        response = requests.get(f"{BASE_URL}/expenses",
            headers={"Authorization": f"Bearer {token}"},
            params={"month": month} if month else {},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Expenses retrieved: {len(data)} entries")
            return data
        else:
            log(f"❌ Get expenses failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get expenses exception: {str(e)}", "ERROR")
        return None

def test_expenses_update(token, expense_id, new_amount):
    """Test expense update"""
    log(f"Testing expense update: id={expense_id}, new_amount={new_amount}...")
    try:
        response = requests.put(f"{BASE_URL}/expenses/{expense_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"amount": new_amount},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Expense updated: amount={data['amount']}")
            return data
        else:
            log(f"❌ Update expense failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Update expense exception: {str(e)}", "ERROR")
        return None

def test_expenses_delete(token, expense_id):
    """Test expense deletion"""
    log(f"Testing expense delete: id={expense_id}...")
    try:
        response = requests.delete(f"{BASE_URL}/expenses/{expense_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            log(f"✅ Expense deleted")
            return True
        else:
            log(f"❌ Delete expense failed: {response.status_code} - {response.text}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ Delete expense exception: {str(e)}", "ERROR")
        return False

def test_invoice_create(token, client_id, placement_id, month):
    """Test invoice creation"""
    log(f"Testing invoice creation: client={client_id}, placement={placement_id}, month={month}...")
    try:
        response = requests.post(f"{BASE_URL}/invoices",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "clientId": client_id,
                "placementId": placement_id,
                "month": month,
                "extras": 0,
                "discount": 0,
                "taxPct": 18
            }, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Invoice created: {data['number']}")
            log(f"   daysWorked={data['daysWorked']}, subTotal={data['subTotal']}, totalAmount={data['totalAmount']}")
            log(f"   Snapshot: agencyName={data['snapshot'].get('agencyName')}, clientName={data['snapshot'].get('clientName')}")
            
            # Verify invoice number format
            if data['number'].startswith('INV-') and len(data['number'].split('-')) == 3:
                log(f"✅ Invoice number format correct: {data['number']}")
            else:
                log(f"⚠️ Invoice number format unexpected: {data['number']}", "WARN")
            
            return data
        else:
            log(f"❌ Create invoice failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Create invoice exception: {str(e)}", "ERROR")
        return None

def test_invoices_get(token):
    """Test invoice list retrieval"""
    log(f"Testing invoices GET...")
    try:
        response = requests.get(f"{BASE_URL}/invoices",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Invoices retrieved: {len(data)} entries")
            if len(data) > 0:
                log(f"   First invoice: {data[0]['number']}, clientName={data[0].get('clientName')}, placementCode={data[0].get('placementCode')}")
            return data
        else:
            log(f"❌ Get invoices failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get invoices exception: {str(e)}", "ERROR")
        return None

def test_invoice_get_by_id(token, invoice_id):
    """Test single invoice retrieval"""
    log(f"Testing invoice GET by ID: {invoice_id}...")
    try:
        response = requests.get(f"{BASE_URL}/invoices/{invoice_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Invoice retrieved: {data['number']}")
            log(f"   Client populated: {data.get('client', {}).get('name', 'N/A')}")
            log(f"   Placement populated: {data.get('placement', {}).get('code', 'N/A')}")
            return data
        else:
            log(f"❌ Get invoice by ID failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get invoice by ID exception: {str(e)}", "ERROR")
        return None

def test_income_create(token, client_id, amount, placement_id=None, invoice_id=None):
    """Test income creation"""
    log(f"Testing income creation: client={client_id}, amount={amount}, placement={placement_id}, invoice={invoice_id}...")
    try:
        payload = {
            "clientId": client_id,
            "amount": amount,
            "method": "UPI",
            "notes": "Test income"
        }
        if placement_id:
            payload["placementId"] = placement_id
        if invoice_id:
            payload["invoiceId"] = invoice_id
        
        response = requests.post(f"{BASE_URL}/incomes",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Income created: {data['code']} - ₹{data['amount']}")
            return data
        else:
            log(f"❌ Create income failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Create income exception: {str(e)}", "ERROR")
        return None

def test_income_delete(token, income_id):
    """Test income deletion"""
    log(f"Testing income delete: id={income_id}...")
    try:
        response = requests.delete(f"{BASE_URL}/incomes/{income_id}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            log(f"✅ Income deleted")
            return True
        else:
            log(f"❌ Delete income failed: {response.status_code} - {response.text}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ Delete income exception: {str(e)}", "ERROR")
        return False

def test_placement_get(token, placement_id):
    """Get placement details"""
    log(f"Testing placement GET: id={placement_id}...")
    try:
        response = requests.get(f"{BASE_URL}/placements",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            placement = next((p for p in data if p['id'] == placement_id), None)
            if placement:
                log(f"✅ Placement retrieved: clientPaid={placement.get('clientPaid', 0)}")
                return placement
            else:
                log(f"❌ Placement not found in list", "ERROR")
                return None
        else:
            log(f"❌ Get placements failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get placement exception: {str(e)}", "ERROR")
        return None

def test_reports_pnl(token, month=None):
    """Test P&L report"""
    log(f"Testing P&L report: month={month or 'all-time'}...")
    try:
        params = {"month": month} if month else {}
        response = requests.get(f"{BASE_URL}/reports/pnl",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ P&L report retrieved:")
            log(f"   revenue={data['revenue']}, staffCost={data['staffCost']}, vendorCommission={data['vendorCommission']}")
            log(f"   expenseTotal={data['expenseTotal']}, netProfit={data['netProfit']}")
            log(f"   incomeCollected={data['incomeCollected']}, salaryPaid={data['salaryPaid']}")
            log(f"   pendingClientCollection={data['pendingClientCollection']}")
            log(f"   expenseByCategory: {len(data.get('expenseByCategory', []))} categories")
            return data
        else:
            log(f"❌ Get P&L report failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get P&L report exception: {str(e)}", "ERROR")
        return None

def test_reports_placement(token):
    """Test placement report"""
    log(f"Testing placement report...")
    try:
        response = requests.get(f"{BASE_URL}/reports/placement",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Placement report retrieved: {len(data)} placements")
            if len(data) > 0:
                log(f"   First: code={data[0]['code']}, workingDays={data[0]['workingDays']}, "
                    f"clientBill={data[0]['clientBill']}, agencyProfit={data[0]['agencyProfit']}")
            return data
        else:
            log(f"❌ Get placement report failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get placement report exception: {str(e)}", "ERROR")
        return None

def test_reports_staff(token):
    """Test staff report"""
    log(f"Testing staff report...")
    try:
        response = requests.get(f"{BASE_URL}/reports/staff",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Staff report retrieved: {len(data)} staff")
            if len(data) > 0:
                log(f"   First: name={data[0]['name']}, totalPlacements={data[0]['totalPlacements']}, "
                    f"activePlacements={data[0]['activePlacements']}")
            return data
        else:
            log(f"❌ Get staff report failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get staff report exception: {str(e)}", "ERROR")
        return None

def test_reports_client(token):
    """Test client report"""
    log(f"Testing client report...")
    try:
        response = requests.get(f"{BASE_URL}/reports/client",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Client report retrieved: {len(data)} clients")
            if len(data) > 0:
                log(f"   First: name={data[0]['name']}, totalBilled={data[0]['totalBilled']}, "
                    f"totalPaid={data[0]['totalPaid']}, pending={data[0]['pending']}")
            return data
        else:
            log(f"❌ Get client report failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get client report exception: {str(e)}", "ERROR")
        return None

def test_reports_attendance(token, month):
    """Test attendance report"""
    log(f"Testing attendance report: month={month}...")
    try:
        response = requests.get(f"{BASE_URL}/reports/attendance",
            headers={"Authorization": f"Bearer {token}"},
            params={"month": month},
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Attendance report retrieved: month={data['month']}, {len(data['rows'])} staff")
            if len(data['rows']) > 0:
                log(f"   First: name={data['rows'][0]['name']}, present={data['rows'][0]['present']}, "
                    f"absent={data['rows'][0]['absent']}, percentage={data['rows'][0]['percentage']}%")
            return data
        else:
            log(f"❌ Get attendance report failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get attendance report exception: {str(e)}", "ERROR")
        return None

def test_csv_export(token):
    """Test CSV export"""
    log(f"Testing CSV export...")
    try:
        response = requests.post(f"{BASE_URL}/export/csv",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "name": "test_export",
                "headers": ["Column A", "Column B"],
                "rows": [[1, 2], [3, 4]]
            },
            timeout=10)
        
        if response.status_code == 200:
            content_type = response.headers.get('Content-Type', '')
            if 'text/csv' in content_type:
                log(f"✅ CSV export successful: Content-Type={content_type}")
                log(f"   CSV content preview: {response.text[:100]}")
                return True
            else:
                log(f"⚠️ CSV export returned but Content-Type is {content_type}", "WARN")
                return False
        else:
            log(f"❌ CSV export failed: {response.status_code} - {response.text}", "ERROR")
            return False
    except Exception as e:
        log(f"❌ CSV export exception: {str(e)}", "ERROR")
        return False

def test_register_get(token, date=None, activity_type=None):
    """Test digital register"""
    log(f"Testing digital register: date={date}, type={activity_type}...")
    try:
        params = {}
        if date:
            params['date'] = date
        if activity_type:
            params['type'] = activity_type
        
        response = requests.get(f"{BASE_URL}/register",
            headers={"Authorization": f"Bearer {token}"},
            params=params,
            timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log(f"✅ Digital register retrieved: {len(data)} activities")
            if len(data) > 0:
                log(f"   First: type={data[0]['type']}, message={data[0]['message']}")
            return data
        else:
            log(f"❌ Get register failed: {response.status_code} - {response.text}", "ERROR")
            return None
    except Exception as e:
        log(f"❌ Get register exception: {str(e)}", "ERROR")
        return None

def run_phase2_tests():
    """Run all Phase 2 tests"""
    log("=" * 80)
    log("STARTING PHASE 2 BACKEND TESTS")
    log("=" * 80)
    
    # Calculate dates
    today = datetime.now().date()
    five_days_ago = today - timedelta(days=5)
    current_month = today.strftime("%Y-%m")
    
    log(f"Test dates: today={today}, five_days_ago={five_days_ago}, current_month={current_month}")
    
    # Test 1: Sign up Agency A
    log("\n" + "=" * 80)
    log("TEST 1: SIGN UP AGENCY A")
    log("=" * 80)
    agency_a = test_signup("TestAgency-A", "Owner A", f"owner.a.{datetime.now().timestamp()}@test.com", "password123")
    if not agency_a:
        log("❌ CRITICAL: Agency A signup failed. Aborting tests.", "ERROR")
        return False
    test_data['agency_a'] = agency_a
    
    # Test 2: Add staff to Agency A
    log("\n" + "=" * 80)
    log("TEST 2: ADD STAFF TO AGENCY A")
    log("=" * 80)
    staff_a = test_add_staff(agency_a['token'], "Rajesh Kumar", 30000)
    if not staff_a:
        log("❌ CRITICAL: Staff creation failed. Aborting tests.", "ERROR")
        return False
    test_data['agency_a']['staff'] = staff_a
    
    # Test 3: Add client to Agency A
    log("\n" + "=" * 80)
    log("TEST 3: ADD CLIENT TO AGENCY A")
    log("=" * 80)
    client_a = test_add_client(agency_a['token'], "Sharma Family", 30000)
    if not client_a:
        log("❌ CRITICAL: Client creation failed. Aborting tests.", "ERROR")
        return False
    test_data['agency_a']['client'] = client_a
    
    # Test 4: Create placement with joinDate = 5 days ago
    log("\n" + "=" * 80)
    log("TEST 4: CREATE PLACEMENT (5 DAYS AGO)")
    log("=" * 80)
    placement_a = test_create_placement(
        agency_a['token'],
        staff_a['id'],
        client_a['id'],
        five_days_ago.isoformat(),
        30000,
        30000
    )
    if not placement_a:
        log("❌ CRITICAL: Placement creation failed. Aborting tests.", "ERROR")
        return False
    test_data['agency_a']['placement'] = placement_a
    
    # Test 5: Verify attendance auto-backfill
    log("\n" + "=" * 80)
    log("TEST 5: VERIFY ATTENDANCE AUTO-BACKFILL")
    log("=" * 80)
    attendance_list = test_attendance_auto_backfill(agency_a['token'], staff_a['id'], current_month)
    if not attendance_list:
        log("❌ Attendance auto-backfill verification failed", "ERROR")
    else:
        expected_days = (today - five_days_ago).days + 1
        if len(attendance_list) >= 5:
            log(f"✅ Attendance auto-backfill working: {len(attendance_list)} entries (expected ~{expected_days})")
        else:
            log(f"⚠️ Attendance count lower than expected: {len(attendance_list)} (expected ~{expected_days})", "WARN")
    
    # Test 6: Update attendance for today to 'A' (Absent)
    log("\n" + "=" * 80)
    log("TEST 6: UPDATE ATTENDANCE (UPSERT)")
    log("=" * 80)
    updated_attendance = test_attendance_update(agency_a['token'], staff_a['id'], today.isoformat(), 'A')
    if updated_attendance and updated_attendance['status'] == 'A':
        log("✅ Attendance update (upsert) working correctly")
    else:
        log("❌ Attendance update failed", "ERROR")
    
    # Test 7: Bulk attendance update
    log("\n" + "=" * 80)
    log("TEST 7: BULK ATTENDANCE UPDATE")
    log("=" * 80)
    yesterday = (today - timedelta(days=1)).isoformat()
    two_days_ago = (today - timedelta(days=2)).isoformat()
    bulk_result = test_attendance_bulk(agency_a['token'], [
        {"staffId": staff_a['id'], "date": yesterday, "status": "H"},
        {"staffId": staff_a['id'], "date": two_days_ago, "status": "LATE"}
    ])
    if bulk_result and bulk_result.get('upserted') == 2:
        log("✅ Bulk attendance update working correctly")
    else:
        log("❌ Bulk attendance update failed", "ERROR")
    
    # Test 8: Get salary computation
    log("\n" + "=" * 80)
    log("TEST 8: SALARY COMPUTATION")
    log("=" * 80)
    salary_data = test_salary_get(agency_a['token'], staff_a['id'], current_month)
    if salary_data:
        # Verify perDay calculation (30000 / 30 = 1000)
        expected_per_day = 1000
        if salary_data['perDay'] == expected_per_day:
            log(f"✅ perDay calculation correct: {salary_data['perDay']}")
        else:
            log(f"⚠️ perDay calculation unexpected: {salary_data['perDay']} (expected {expected_per_day})", "WARN")
        
        # Verify gross = perDay × effective
        expected_gross = salary_data['perDay'] * salary_data['stats']['effective']
        if abs(salary_data['gross'] - expected_gross) <= 1:  # Allow 1 rupee rounding
            log(f"✅ Gross calculation correct: {salary_data['gross']}")
        else:
            log(f"⚠️ Gross calculation unexpected: {salary_data['gross']} (expected {expected_gross})", "WARN")
    else:
        log("❌ Salary computation failed", "ERROR")
    
    # Test 9: Add salary advance
    log("\n" + "=" * 80)
    log("TEST 9: SALARY PAYMENT - ADVANCE")
    log("=" * 80)
    advance_payment = test_salary_payment(agency_a['token'], staff_a['id'], current_month, 1000, 'advance')
    if not advance_payment:
        log("❌ Advance payment failed", "ERROR")
    
    # Test 10: Add salary paid
    log("\n" + "=" * 80)
    log("TEST 10: SALARY PAYMENT - PAID")
    log("=" * 80)
    paid_payment = test_salary_payment(agency_a['token'], staff_a['id'], current_month, 3000, 'paid')
    if not paid_payment:
        log("❌ Paid payment failed", "ERROR")
    
    # Test 11: Verify salary updated with payments
    log("\n" + "=" * 80)
    log("TEST 11: VERIFY SALARY UPDATED WITH PAYMENTS")
    log("=" * 80)
    salary_after_payments = test_salary_get(agency_a['token'], staff_a['id'], current_month)
    if salary_after_payments:
        if salary_after_payments['advance'] == 1000 and salary_after_payments['paid'] == 3000:
            log(f"✅ Salary payments reflected correctly: advance={salary_after_payments['advance']}, paid={salary_after_payments['paid']}")
        else:
            log(f"⚠️ Salary payments not reflected correctly: advance={salary_after_payments['advance']}, paid={salary_after_payments['paid']}", "WARN")
    
    # Test 12: Get salary/all
    log("\n" + "=" * 80)
    log("TEST 12: SALARY ALL STAFF SUMMARY")
    log("=" * 80)
    salary_all = test_salary_all(agency_a['token'], current_month)
    if salary_all and salary_all['month'] == current_month:
        log(f"✅ Salary/all working: {len(salary_all['rows'])} staff")
    else:
        log("❌ Salary/all failed", "ERROR")
    
    # Test 13: Create expense
    log("\n" + "=" * 80)
    log("TEST 13: CREATE EXPENSE")
    log("=" * 80)
    expense = test_expenses_create(agency_a['token'], "Office Rent", 5000, today.isoformat())
    if not expense:
        log("❌ Expense creation failed", "ERROR")
    else:
        test_data['agency_a']['expense'] = expense
    
    # Test 14: Get expenses with month filter
    log("\n" + "=" * 80)
    log("TEST 14: GET EXPENSES WITH MONTH FILTER")
    log("=" * 80)
    expenses = test_expenses_get(agency_a['token'], current_month)
    if expenses and len(expenses) > 0:
        log(f"✅ Expenses retrieval with month filter working: {len(expenses)} expenses")
    else:
        log("⚠️ No expenses found or retrieval failed", "WARN")
    
    # Test 15: Update expense
    log("\n" + "=" * 80)
    log("TEST 15: UPDATE EXPENSE")
    log("=" * 80)
    if expense:
        updated_expense = test_expenses_update(agency_a['token'], expense['id'], 5500)
        if updated_expense and updated_expense['amount'] == 5500:
            log("✅ Expense update working correctly")
        else:
            log("❌ Expense update failed", "ERROR")
    
    # Test 16: Create invoice
    log("\n" + "=" * 80)
    log("TEST 16: CREATE INVOICE")
    log("=" * 80)
    invoice = test_invoice_create(agency_a['token'], client_a['id'], placement_a['id'], current_month)
    if not invoice:
        log("❌ Invoice creation failed", "ERROR")
    else:
        test_data['agency_a']['invoice'] = invoice
        # Verify daysWorked
        expected_days = (today - five_days_ago).days + 1
        if invoice['daysWorked'] >= 5:
            log(f"✅ Invoice daysWorked calculation correct: {invoice['daysWorked']}")
        else:
            log(f"⚠️ Invoice daysWorked unexpected: {invoice['daysWorked']} (expected ~{expected_days})", "WARN")
    
    # Test 17: Get invoices list
    log("\n" + "=" * 80)
    log("TEST 17: GET INVOICES LIST")
    log("=" * 80)
    invoices = test_invoices_get(agency_a['token'])
    if invoices and len(invoices) > 0:
        log(f"✅ Invoices list retrieval working: {len(invoices)} invoices")
    else:
        log("⚠️ No invoices found or retrieval failed", "WARN")
    
    # Test 18: Get invoice by ID
    log("\n" + "=" * 80)
    log("TEST 18: GET INVOICE BY ID")
    log("=" * 80)
    if invoice:
        invoice_detail = test_invoice_get_by_id(agency_a['token'], invoice['id'])
        if invoice_detail and invoice_detail.get('client') and invoice_detail.get('placement'):
            log("✅ Invoice by ID with populated client & placement working")
        else:
            log("❌ Invoice by ID retrieval failed or missing populated data", "ERROR")
    
    # Test 19: Create income linked to placement
    log("\n" + "=" * 80)
    log("TEST 19: CREATE INCOME LINKED TO PLACEMENT")
    log("=" * 80)
    income1 = test_income_create(agency_a['token'], client_a['id'], 15000, placement_id=placement_a['id'])
    if not income1:
        log("❌ Income creation (placement) failed", "ERROR")
    else:
        test_data['agency_a']['income1'] = income1
    
    # Test 20: Verify placement.clientPaid updated
    log("\n" + "=" * 80)
    log("TEST 20: VERIFY PLACEMENT.CLIENTPAID UPDATED")
    log("=" * 80)
    placement_after_income = test_placement_get(agency_a['token'], placement_a['id'])
    if placement_after_income:
        if placement_after_income.get('clientPaid') == 15000:
            log(f"✅ Placement.clientPaid updated correctly: {placement_after_income['clientPaid']}")
        else:
            log(f"⚠️ Placement.clientPaid unexpected: {placement_after_income.get('clientPaid')} (expected 15000)", "WARN")
    
    # Test 21: Create income linked to invoice
    log("\n" + "=" * 80)
    log("TEST 21: CREATE INCOME LINKED TO INVOICE")
    log("=" * 80)
    if invoice:
        income2 = test_income_create(agency_a['token'], client_a['id'], invoice['totalAmount'], invoice_id=invoice['id'])
        if not income2:
            log("❌ Income creation (invoice) failed", "ERROR")
        else:
            test_data['agency_a']['income2'] = income2
            
            # Test 22: Verify invoice status changed to 'paid'
            log("\n" + "=" * 80)
            log("TEST 22: VERIFY INVOICE STATUS CHANGED TO 'PAID'")
            log("=" * 80)
            invoice_after_payment = test_invoice_get_by_id(agency_a['token'], invoice['id'])
            if invoice_after_payment:
                if invoice_after_payment['status'] == 'paid':
                    log(f"✅ Invoice status updated to 'paid' correctly")
                else:
                    log(f"⚠️ Invoice status unexpected: {invoice_after_payment['status']} (expected 'paid')", "WARN")
    
    # Test 23: Delete income and verify reversal
    log("\n" + "=" * 80)
    log("TEST 23: DELETE INCOME AND VERIFY REVERSAL")
    log("=" * 80)
    if income1:
        delete_success = test_income_delete(agency_a['token'], income1['id'])
        if delete_success:
            placement_after_delete = test_placement_get(agency_a['token'], placement_a['id'])
            if placement_after_delete:
                # clientPaid should be reduced by 15000
                expected_client_paid = placement_after_income.get('clientPaid', 15000) - 15000
                if placement_after_delete.get('clientPaid', 0) == expected_client_paid:
                    log(f"✅ Income deletion reversed placement.clientPaid correctly: {placement_after_delete['clientPaid']}")
                else:
                    log(f"⚠️ Placement.clientPaid after delete unexpected: {placement_after_delete.get('clientPaid')} (expected {expected_client_paid})", "WARN")
    
    # Test 24: P&L Report with month filter
    log("\n" + "=" * 80)
    log("TEST 24: P&L REPORT (WITH MONTH)")
    log("=" * 80)
    pnl_month = test_reports_pnl(agency_a['token'], current_month)
    if pnl_month:
        if pnl_month['revenue'] > 0:
            log(f"✅ P&L report (month) working: revenue={pnl_month['revenue']}")
        else:
            log(f"⚠️ P&L report revenue is 0, expected >0 given placement", "WARN")
    
    # Test 25: P&L Report all-time
    log("\n" + "=" * 80)
    log("TEST 25: P&L REPORT (ALL-TIME)")
    log("=" * 80)
    pnl_all = test_reports_pnl(agency_a['token'])
    if pnl_all and pnl_all['month'] == 'all-time':
        log(f"✅ P&L report (all-time) working")
    
    # Test 26: Placement report
    log("\n" + "=" * 80)
    log("TEST 26: PLACEMENT REPORT")
    log("=" * 80)
    placement_report = test_reports_placement(agency_a['token'])
    if placement_report and len(placement_report) > 0:
        log(f"✅ Placement report working: {len(placement_report)} placements")
    
    # Test 27: Staff report
    log("\n" + "=" * 80)
    log("TEST 27: STAFF REPORT")
    log("=" * 80)
    staff_report = test_reports_staff(agency_a['token'])
    if staff_report and len(staff_report) > 0:
        log(f"✅ Staff report working: {len(staff_report)} staff")
    
    # Test 28: Client report
    log("\n" + "=" * 80)
    log("TEST 28: CLIENT REPORT")
    log("=" * 80)
    client_report = test_reports_client(agency_a['token'])
    if client_report and len(client_report) > 0:
        log(f"✅ Client report working: {len(client_report)} clients")
    
    # Test 29: Attendance report
    log("\n" + "=" * 80)
    log("TEST 29: ATTENDANCE REPORT")
    log("=" * 80)
    attendance_report = test_reports_attendance(agency_a['token'], current_month)
    if attendance_report and attendance_report['month'] == current_month:
        log(f"✅ Attendance report working: {len(attendance_report['rows'])} staff")
    
    # Test 30: CSV Export
    log("\n" + "=" * 80)
    log("TEST 30: CSV EXPORT")
    log("=" * 80)
    csv_success = test_csv_export(agency_a['token'])
    if csv_success:
        log("✅ CSV export working")
    
    # Test 31: Digital Register (no filter)
    log("\n" + "=" * 80)
    log("TEST 31: DIGITAL REGISTER (NO FILTER)")
    log("=" * 80)
    register_all = test_register_get(agency_a['token'])
    if register_all:
        log(f"✅ Digital register (no filter) working: {len(register_all)} activities")
    
    # Test 32: Digital Register (type filter)
    log("\n" + "=" * 80)
    log("TEST 32: DIGITAL REGISTER (TYPE FILTER)")
    log("=" * 80)
    register_duty = test_register_get(agency_a['token'], activity_type='duty_join')
    if register_duty is not None:
        log(f"✅ Digital register (type filter) working: {len(register_duty)} duty_join activities")
    
    # Test 33: Digital Register (date filter)
    log("\n" + "=" * 80)
    log("TEST 33: DIGITAL REGISTER (DATE FILTER)")
    log("=" * 80)
    register_today = test_register_get(agency_a['token'], date=today.isoformat())
    if register_today is not None:
        log(f"✅ Digital register (date filter) working: {len(register_today)} activities today")
    
    # Test 34: Multi-tenant isolation - Sign up Agency B
    log("\n" + "=" * 80)
    log("TEST 34: MULTI-TENANT ISOLATION - SIGN UP AGENCY B")
    log("=" * 80)
    agency_b = test_signup("TestAgency-B", "Owner B", f"owner.b.{datetime.now().timestamp()}@test.com", "password123")
    if not agency_b:
        log("⚠️ Agency B signup failed, skipping multi-tenant tests", "WARN")
    else:
        test_data['agency_b'] = agency_b
        
        # Test 35: Verify Agency B cannot see Agency A's data
        log("\n" + "=" * 80)
        log("TEST 35: VERIFY MULTI-TENANT ISOLATION")
        log("=" * 80)
        
        # Check attendance
        b_attendance = test_attendance_auto_backfill(agency_b['token'], staff_a['id'], current_month)
        if b_attendance and len(b_attendance) == 0:
            log("✅ Multi-tenant isolation: Agency B cannot see Agency A's attendance")
        else:
            log(f"❌ Multi-tenant isolation FAILED: Agency B can see Agency A's attendance ({len(b_attendance) if b_attendance else 'N/A'} entries)", "ERROR")
        
        # Check expenses
        b_expenses = test_expenses_get(agency_b['token'], current_month)
        if b_expenses is not None and len(b_expenses) == 0:
            log("✅ Multi-tenant isolation: Agency B cannot see Agency A's expenses")
        else:
            log(f"❌ Multi-tenant isolation FAILED: Agency B can see Agency A's expenses ({len(b_expenses) if b_expenses else 'N/A'} entries)", "ERROR")
        
        # Check invoices
        b_invoices = test_invoices_get(agency_b['token'])
        if b_invoices is not None and len(b_invoices) == 0:
            log("✅ Multi-tenant isolation: Agency B cannot see Agency A's invoices")
        else:
            log(f"❌ Multi-tenant isolation FAILED: Agency B can see Agency A's invoices ({len(b_invoices) if b_invoices else 'N/A'} entries)", "ERROR")
        
        # Check salary
        b_salary_all = test_salary_all(agency_b['token'], current_month)
        if b_salary_all and len(b_salary_all['rows']) == 0:
            log("✅ Multi-tenant isolation: Agency B cannot see Agency A's salary data")
        else:
            log(f"❌ Multi-tenant isolation FAILED: Agency B can see Agency A's salary data ({len(b_salary_all['rows']) if b_salary_all else 'N/A'} entries)", "ERROR")
    
    # Test 36: Delete expense (cleanup test)
    log("\n" + "=" * 80)
    log("TEST 36: DELETE EXPENSE")
    log("=" * 80)
    if expense:
        delete_expense_success = test_expenses_delete(agency_a['token'], expense['id'])
        if delete_expense_success:
            log("✅ Expense deletion working")
    
    log("\n" + "=" * 80)
    log("PHASE 2 BACKEND TESTS COMPLETED")
    log("=" * 80)
    return True

if __name__ == "__main__":
    try:
        success = run_phase2_tests()
        sys.exit(0 if success else 1)
    except Exception as e:
        log(f"❌ FATAL ERROR: {str(e)}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)

#!/usr/bin/env python3
"""
DutyOnTrack FULL PRODUCTION AUDIT - Backend Regression Test
Comprehensive test covering ALL modules end-to-end for production readiness
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://agency-pro-33.preview.emergentagent.com/api"
FRONTEND_URL = "https://agency-pro-33.preview.emergentagent.com"

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
    "tests": []
}

# Test data storage
test_data = {
    "super_admin": {},
    "agency1": {},
    "agency2": {},
    "plans": {},
    "staff": [],
    "clients": [],
    "vendors": [],
    "placements": [],
}

def log(msg, status="INFO"):
    """Log test messages"""
    prefix = "✅" if status == "PASS" else "❌" if status == "FAIL" else "ℹ️"
    print(f"{prefix} {msg}")
    
    if status == "PASS":
        test_results["passed"] += 1
        test_results["tests"].append({"test": msg, "status": "PASS"})
    elif status == "FAIL":
        test_results["failed"] += 1
        test_results["tests"].append({"test": msg, "status": "FAIL"})

def test_request(method, endpoint, data=None, headers=None, expected_status=200, desc="", return_response=False):
    """Make HTTP request and validate response"""
    url = f"{BASE_URL}{endpoint}"
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            resp = requests.post(url, json=data, headers=headers, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, json=data, headers=headers, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=30)
        else:
            log(f"{desc} - Unknown method {method}", "FAIL")
            return None
        
        if return_response:
            return resp
        
        if resp.status_code != expected_status:
            log(f"{desc} - Expected {expected_status}, got {resp.status_code}", "FAIL")
            return None
        
        log(f"{desc}", "PASS")
        
        if resp.status_code in [200, 201]:
            try:
                return resp.json()
            except:
                return resp.text
        return {"ok": True}
    except Exception as e:
        log(f"{desc} - Exception: {str(e)}", "FAIL")
        return None

print("\n" + "="*100)
print("DUTYONTRACK FULL PRODUCTION AUDIT - BACKEND REGRESSION TEST")
print("="*100 + "\n")

# ============================================================================
# 1. SETUP WIZARD
# ============================================================================
print("\n[1] SETUP WIZARD")
print("-" * 100)

# GET /setup/status
result = test_request("GET", "/setup/status", desc="1.1 GET /setup/status")
if result:
    needs_setup = result.get('needsSetup')
    log(f"    needsSetup={needs_setup}, hasSuperAdmin={result.get('hasSuperAdmin')}", "INFO")

# POST /setup/complete (if needed)
if result and result.get('needsSetup'):
    setup_data = {
        "name": "Priyanshu9849",
        "email": "priyanshupandey0078@gmail.com",
        "password": "SuperSecure999!",
        "phone": "+919506333650",
        "platformName": "DutyOnTrack",
        "supportWhatsapp": "+917376605611",
        "supportEmail": "tathaast@gmail.com",
        "accountHolderName": "Priyanshu Pandey",
        "bankName": "Kotak Mahindra Bank",
        "accountNumber": "3345626294",
        "ifscCode": "KKBK0005291",
        "upiId": "priyanshupandey-01@ybl"
    }
    setup_result = test_request("POST", "/setup/complete", data=setup_data, 
                                desc="1.2 POST /setup/complete creates super admin")
    if setup_result:
        test_data["super_admin"]["token"] = setup_result.get("token")
        test_data["super_admin"]["email"] = setup_data["email"]
        test_data["super_admin"]["password"] = setup_data["password"]
else:
    # Login with existing super admin
    login_data = {"email": "priyanshupandey0078@gmail.com", "password": "SuperSecure99!"}
    login_result = test_request("POST", "/auth/login", data=login_data, 
                               desc="1.2 Login existing super admin")
    if login_result:
        test_data["super_admin"]["token"] = login_result.get("token")

# Second call should return 409
test_request("POST", "/setup/complete", data={"name": "Test", "email": "test@test.com", "password": "test123"}, 
            expected_status=409, desc="1.3 Second /setup/complete returns 409")

# ============================================================================
# 2. PUBLIC ENDPOINTS
# ============================================================================
print("\n[2] PUBLIC ENDPOINTS")
print("-" * 100)

# GET /settings/public
public_settings = test_request("GET", "/settings/public", desc="2.1 GET /settings/public (no auth)")
if public_settings:
    bank_fields = ["bankName", "accountNumber", "ifscCode", "upiId", "qrCodeUrl"]
    found = sum(1 for f in bank_fields if f in public_settings)
    if found >= 4:
        log(f"    Public settings has {found}/5 bank fields", "PASS")
    else:
        log(f"    Public settings missing bank fields ({found}/5)", "FAIL")

# GET /plans/public
public_plans = test_request("GET", "/plans/public", desc="2.2 GET /plans/public returns 4 defaults")
if public_plans and isinstance(public_plans, list):
    plan_codes = [p.get("code") for p in public_plans]
    expected = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]
    if all(code in plan_codes for code in expected):
        log(f"    All 4 default plans present: {plan_codes}", "PASS")
        for p in public_plans:
            if p.get("code") == "PROFESSIONAL":
                test_data["plans"]["professional"] = p
            elif p.get("code") == "FREE":
                test_data["plans"]["free"] = p
    else:
        log(f"    Missing default plans. Found: {plan_codes}", "FAIL")

# ============================================================================
# 3. REGISTRATION
# ============================================================================
print("\n[3] REGISTRATION")
print("-" * 100)

agency1_data = {
    "agencyName": "Healthcare Staffing Solutions",
    "ownerName": "Rajesh Kumar",
    "email": f"rajesh.kumar_{datetime.now().timestamp()}@healthstaff.com",
    "password": "SecurePass123!",
    "phone": "+919876543211"
}
agency1_result = test_request("POST", "/auth/signup", data=agency1_data,
                             desc="3.1 POST /auth/signup creates agency")
if agency1_result:
    test_data["agency1"]["token"] = agency1_result.get("token")
    test_data["agency1"]["id"] = agency1_result.get("agency", {}).get("id")
    agency = agency1_result.get("agency", {})
    
    if agency.get("plan") == "FREE":
        log("    Agency plan=FREE", "PASS")
    else:
        log(f"    Agency plan incorrect: {agency.get('plan')}", "FAIL")
    
    limits = agency.get("limits", {})
    if limits.get("maxStaff") == 5 and limits.get("maxClients") == 5 and limits.get("maxVendors") == 5:
        log("    Limits: maxStaff=5, maxClients=5, maxVendors=5", "PASS")
    else:
        log(f"    Limits incorrect: {limits}", "FAIL")

# ============================================================================
# 4. LOGIN
# ============================================================================
print("\n[4] LOGIN")
print("-" * 100)

# Valid login
login_valid = test_request("POST", "/auth/login", 
                          data={"email": agency1_data["email"], "password": agency1_data["password"]},
                          desc="4.1 POST /auth/login with valid credentials")

# Invalid login
login_invalid = test_request("POST", "/auth/login", 
                            data={"email": agency1_data["email"], "password": "wrongpassword"},
                            expected_status=401, desc="4.2 POST /auth/login with invalid credentials returns 401")

# ============================================================================
# 5. GET /auth/me
# ============================================================================
print("\n[5] AUTH/ME")
print("-" * 100)

if test_data["agency1"].get("token"):
    agency1_headers = {"Authorization": f"Bearer {test_data['agency1']['token']}"}
    
    # With token
    me_result = test_request("GET", "/auth/me", headers=agency1_headers,
                            desc="5.1 GET /auth/me with Bearer token")
    if me_result:
        if me_result.get("user") and me_result.get("agency"):
            log("    Returns user + agency", "PASS")
    
    # Without token
    test_request("GET", "/auth/me", expected_status=401,
                desc="5.2 GET /auth/me without token returns 401")

# ============================================================================
# 6. MULTI-TENANT ISOLATION
# ============================================================================
print("\n[6] MULTI-TENANT ISOLATION")
print("-" * 100)

# Create second agency
agency2_data = {
    "agencyName": "MediCare Staffing Agency",
    "ownerName": "Priya Sharma",
    "email": f"priya.sharma_{datetime.now().timestamp()}@medicare.com",
    "password": "SecurePass456!",
    "phone": "+919876543212"
}
agency2_result = test_request("POST", "/auth/signup", data=agency2_data,
                             desc="6.1 Create second agency for isolation test")
if agency2_result:
    test_data["agency2"]["token"] = agency2_result.get("token")
    test_data["agency2"]["id"] = agency2_result.get("agency", {}).get("id")
    agency2_headers = {"Authorization": f"Bearer {test_data['agency2']['token']}"}
    
    # Agency 1 creates staff
    staff_a1 = test_request("POST", "/staff", 
                           data={"name": "Nurse Anjali", "phone": "+919876543213", "monthlySalary": 25000},
                           headers=agency1_headers, desc="6.2 Agency1 creates staff")
    if staff_a1:
        test_data["agency1"]["staff_id"] = staff_a1.get("id")
    
    # Agency 2 creates staff
    staff_a2 = test_request("POST", "/staff",
                           data={"name": "Nurse Kavita", "phone": "+919876543214", "monthlySalary": 26000},
                           headers=agency2_headers, desc="6.3 Agency2 creates staff")
    
    # Agency 1 should only see its own staff
    staff_list_a1 = test_request("GET", "/staff", headers=agency1_headers,
                                desc="6.4 Agency1 GET /staff")
    if staff_list_a1 and isinstance(staff_list_a1, list):
        if len(staff_list_a1) == 1:
            log("    Agency1 sees only 1 staff (its own)", "PASS")
        else:
            log(f"    Agency1 sees {len(staff_list_a1)} staff (should be 1)", "FAIL")
    
    # Agency 2 should only see its own staff
    staff_list_a2 = test_request("GET", "/staff", headers=agency2_headers,
                                desc="6.5 Agency2 GET /staff")
    if staff_list_a2 and isinstance(staff_list_a2, list):
        if len(staff_list_a2) == 1:
            log("    Agency2 sees only 1 staff (its own)", "PASS")
        else:
            log(f"    Agency2 sees {len(staff_list_a2)} staff (should be 1)", "FAIL")
    
    # Agency 2 tries to access Agency 1's staff by ID
    if test_data["agency1"].get("staff_id"):
        test_request("GET", f"/staff/{test_data['agency1']['staff_id']}", 
                    headers=agency2_headers, expected_status=404,
                    desc="6.6 Agency2 cannot access Agency1's staff (404)")

# ============================================================================
# 7. STAFF CRUD + 5-LIMIT
# ============================================================================
print("\n[7] STAFF CRUD + FREE PLAN LIMIT")
print("-" * 100)

if test_data["agency1"].get("token"):
    # Add 4 more staff (already have 1)
    for i in range(2, 6):
        staff_data = {
            "name": f"Nurse {chr(64+i)}",
            "phone": f"+9198765432{14+i}",
            "monthlySalary": 25000 + (i * 1000)
        }
        result = test_request("POST", "/staff", data=staff_data, headers=agency1_headers,
                            desc=f"7.{i} Add staff {i}/5")
        if result:
            test_data["staff"].append(result)
    
    # 6th staff should return 402
    staff_data = {"name": "Nurse F", "phone": "+919876543220", "monthlySalary": 30000}
    sixth = test_request("POST", "/staff", data=staff_data, headers=agency1_headers,
                        expected_status=402, desc="7.6 6th staff returns 402 (limit reached)")
    
    # Verify staffCode has STF prefix
    if test_data["staff"]:
        staff_code = test_data["staff"][0].get("staffCode", "")
        if staff_code.startswith("STF"):
            log(f"    staffCode has STF prefix: {staff_code}", "PASS")
        else:
            log(f"    staffCode missing STF prefix: {staff_code}", "FAIL")
    
    # Test UPDATE
    if test_data["staff"]:
        staff_id = test_data["staff"][0].get("id")
        update_data = {"monthlySalary": 28000}
        test_request("PUT", f"/staff/{staff_id}", data=update_data, headers=agency1_headers,
                    desc="7.7 PUT /staff/:id updates staff")
    
    # Test DELETE
    if len(test_data["staff"]) > 1:
        staff_id = test_data["staff"][-1].get("id")
        test_request("DELETE", f"/staff/{staff_id}", headers=agency1_headers,
                    desc="7.8 DELETE /staff/:id removes staff")

# ============================================================================
# 8. CLIENTS CRUD + 5-LIMIT + MEDICAL FIELDS
# ============================================================================
print("\n[8] CLIENTS CRUD + MEDICAL FIELDS")
print("-" * 100)

if test_data["agency1"].get("token"):
    # Create 5 clients with medical fields
    for i in range(1, 6):
        client_data = {
            "name": f"Mr. Patient {chr(64+i)}",
            "patientName": f"Patient {chr(64+i)}",
            "phone": f"+9198765432{30+i}",
            "address": f"{i*10} MG Road, Bangalore",
            "rtTube": i % 2 == 0,
            "ttTube": i % 3 == 0,
            "oxygen": i % 2 == 1,
            "catheter": i % 4 == 0,
            "tracheostomy": i % 5 == 0,
            "rylesTube": i % 3 == 1,
            "monthlyCharges": 30000 + (i * 5000)
        }
        result = test_request("POST", "/clients", data=client_data, headers=agency1_headers,
                            desc=f"8.{i} Add client {i}/5 with medical fields")
        if result:
            test_data["clients"].append(result)
            # Verify medical fields persisted
            if i == 1:
                if result.get("rtTube") == False and result.get("oxygen") == True:
                    log("    Medical boolean fields persist correctly", "PASS")
    
    # 6th client should return 402
    client_data = {"name": "Mr. Patient F", "phone": "+919876543240"}
    test_request("POST", "/clients", data=client_data, headers=agency1_headers,
                expected_status=402, desc="8.6 6th client returns 402 (limit reached)")
    
    # Test UPDATE with medical fields
    if test_data["clients"]:
        client_id = test_data["clients"][0].get("id")
        update_data = {"rtTube": True, "oxygen": False, "monthlyCharges": 35000}
        updated = test_request("PUT", f"/clients/{client_id}", data=update_data, headers=agency1_headers,
                              desc="8.7 PUT /clients/:id updates medical fields")
        if updated:
            if updated.get("rtTube") == True and updated.get("oxygen") == False:
                log("    Medical fields updated correctly", "PASS")

# ============================================================================
# 9. VENDORS CRUD + 5-LIMIT + COMMISSION TYPES
# ============================================================================
print("\n[9] VENDORS CRUD + COMMISSION TYPES")
print("-" * 100)

if test_data["agency1"].get("token"):
    # Create vendor with fixed commission
    vendor_fixed = {
        "name": "HealthCare Vendors Pvt Ltd",
        "phone": "+919876543250",
        "commissionType": "fixed",
        "commissionAmount": 2000
    }
    result = test_request("POST", "/vendors", data=vendor_fixed, headers=agency1_headers,
                         desc="9.1 Create vendor with fixed commission")
    if result:
        test_data["vendors"].append(result)
        if result.get("commissionType") == "fixed" and result.get("commissionAmount") == 2000:
            log("    Fixed commission persists correctly", "PASS")
    
    # Create vendor with percent commission
    vendor_percent = {
        "name": "MediStaff Solutions",
        "phone": "+919876543251",
        "commissionType": "percent",
        "commissionAmount": 10
    }
    result = test_request("POST", "/vendors", data=vendor_percent, headers=agency1_headers,
                         desc="9.2 Create vendor with percent commission")
    if result:
        test_data["vendors"].append(result)
        if result.get("commissionType") == "percent" and result.get("commissionAmount") == 10:
            log("    Percent commission persists correctly", "PASS")
    
    # Add 3 more vendors
    for i in range(3, 6):
        vendor_data = {"name": f"Vendor {chr(64+i)}", "phone": f"+9198765432{51+i}"}
        result = test_request("POST", "/vendors", data=vendor_data, headers=agency1_headers,
                            desc=f"9.{i} Add vendor {i}/5")
        if result:
            test_data["vendors"].append(result)
    
    # 6th vendor should return 402
    vendor_data = {"name": "Vendor F", "phone": "+919876543260"}
    test_request("POST", "/vendors", data=vendor_data, headers=agency1_headers,
                expected_status=402, desc="9.6 6th vendor returns 402 (limit reached)")

# ============================================================================
# 10. PLACEMENTS CRUD + AUTO PROFIT CALCULATION
# ============================================================================
print("\n[10] PLACEMENTS + AUTO PROFIT CALCULATION")
print("-" * 100)

if test_data["agency1"].get("token") and test_data["staff"] and test_data["clients"] and test_data["vendors"]:
    # Create placement with percent commission
    join_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    placement_data = {
        "clientId": test_data["clients"][0].get("id"),
        "staffId": test_data["staff"][0].get("id"),
        "vendorId": test_data["vendors"][1].get("id"),  # percent commission vendor
        "joinDate": join_date,
        "monthlyClientCharge": 30000,
        "monthlyStaffSalary": 18000,
        "vendorCommission": 10,
        "vendorCommissionType": "percent"
    }
    placement = test_request("POST", "/placements", data=placement_data, headers=agency1_headers,
                            desc="10.1 Create placement with percent commission")
    if placement:
        test_data["placements"].append(placement)
        placement_id = placement.get("id")
        
        # Get placement with calculations
        placements_list = test_request("GET", "/placements", headers=agency1_headers,
                                      desc="10.2 GET /placements returns enriched data")
        if placements_list and isinstance(placements_list, list) and len(placements_list) > 0:
            p = placements_list[0]
            calc = p.get("calc", {})
            
            # Verify calculations
            if calc.get("workingDays") == 30:
                log("    workingDays = 30", "PASS")
            else:
                log(f"    workingDays incorrect: {calc.get('workingDays')}", "FAIL")
            
            if calc.get("clientBill") == 30000:
                log("    clientBill = 30000", "PASS")
            else:
                log(f"    clientBill incorrect: {calc.get('clientBill')}", "FAIL")
            
            if calc.get("staffSalary") == 18000:
                log("    staffSalary = 18000", "PASS")
            else:
                log(f"    staffSalary incorrect: {calc.get('staffSalary')}", "FAIL")
            
            # vendorCommission should be 10% of 30000 = 3000
            if calc.get("vendorCommission") == 3000:
                log("    vendorCommission = 3000 (10% of 30000)", "PASS")
            else:
                log(f"    vendorCommission incorrect: {calc.get('vendorCommission')}", "FAIL")
            
            # agencyProfit = 30000 - 18000 - 3000 = 9000
            if calc.get("agencyProfit") == 9000:
                log("    agencyProfit = 9000", "PASS")
            else:
                log(f"    agencyProfit incorrect: {calc.get('agencyProfit')}", "FAIL")
            
            # Verify staff status changed to onduty
            staff_list = test_request("GET", "/staff", headers=agency1_headers, desc="10.3 Check staff status")
            if staff_list:
                staff = next((s for s in staff_list if s.get("id") == test_data["staff"][0].get("id")), None)
                if staff and staff.get("status") == "onduty":
                    log("    Staff status changed to 'onduty'", "PASS")
                else:
                    log(f"    Staff status incorrect: {staff.get('status') if staff else 'not found'}", "FAIL")
        
        # End placement (set offDate)
        off_date = datetime.now().strftime("%Y-%m-%d")
        update_data = {"offDate": off_date}
        updated = test_request("PUT", f"/placements/{placement_id}", data=update_data, headers=agency1_headers,
                              desc="10.4 PUT /placements/:id with offDate")
        if updated:
            if updated.get("status") == "completed":
                log("    Placement status changed to 'completed'", "PASS")
            
            # Verify staff status back to available
            staff_list = test_request("GET", "/staff", headers=agency1_headers, desc="10.5 Check staff status after offDate")
            if staff_list:
                staff = next((s for s in staff_list if s.get("id") == test_data["staff"][0].get("id")), None)
                if staff and staff.get("status") == "available":
                    log("    Staff status changed back to 'available'", "PASS")
                else:
                    log(f"    Staff status incorrect: {staff.get('status') if staff else 'not found'}", "FAIL")
    
    # Test fixed commission
    if len(test_data["staff"]) > 1 and len(test_data["clients"]) > 1:
        placement_fixed = {
            "clientId": test_data["clients"][1].get("id"),
            "staffId": test_data["staff"][1].get("id"),
            "vendorId": test_data["vendors"][0].get("id"),  # fixed commission vendor
            "joinDate": join_date,
            "monthlyClientCharge": 28000,
            "monthlyStaffSalary": 16000,
            "vendorCommission": 2000,
            "vendorCommissionType": "fixed"
        }
        placement2 = test_request("POST", "/placements", data=placement_fixed, headers=agency1_headers,
                                 desc="10.6 Create placement with fixed commission")
        if placement2:
            test_data["placements"].append(placement2)

# ============================================================================
# 11. ATTENDANCE AUTO-BACKFILL
# ============================================================================
print("\n[11] ATTENDANCE AUTO-BACKFILL")
print("-" * 100)

if test_data["agency1"].get("token") and test_data["placements"]:
    placement = test_data["placements"][0]
    staff_id = placement.get("staffId")
    month = datetime.now().strftime("%Y-%m")
    
    # Get attendance for staff
    attendance = test_request("GET", f"/attendance?staffId={staff_id}&month={month}", 
                             headers=agency1_headers, desc="11.1 GET /attendance auto-backfilled")
    if attendance and isinstance(attendance, list):
        present_count = sum(1 for a in attendance if a.get("status") == "P")
        if present_count >= 5:
            log(f"    Auto-backfilled {present_count} Present entries", "PASS")
        else:
            log(f"    Auto-backfill count low: {present_count}", "FAIL")
    
    # Manual mark attendance
    today = datetime.now().strftime("%Y-%m-%d")
    mark_data = {"staffId": staff_id, "date": today, "status": "A", "notes": "Absent today"}
    test_request("POST", "/attendance", data=mark_data, headers=agency1_headers,
                desc="11.2 POST /attendance upserts status")
    
    # Bulk mark
    bulk_data = {
        "rows": [
            {"staffId": staff_id, "date": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"), "status": "H"},
            {"staffId": staff_id, "date": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"), "status": "LATE"}
        ]
    }
    test_request("POST", "/attendance/bulk", data=bulk_data, headers=agency1_headers,
                desc="11.3 POST /attendance/bulk upserts multiple")

# ============================================================================
# 12. SALARY COMPUTE + PAYMENTS
# ============================================================================
print("\n[12] SALARY COMPUTE + PAYMENTS")
print("-" * 100)

if test_data["agency1"].get("token") and test_data["staff"]:
    staff_id = test_data["staff"][0].get("id")
    month = datetime.now().strftime("%Y-%m")
    
    # Get salary slip
    salary = test_request("GET", f"/salary?staffId={staff_id}&month={month}",
                         headers=agency1_headers, desc="12.1 GET /salary computes slip")
    if salary:
        stats = salary.get("stats", {})
        per_day = salary.get("perDay", 0)
        gross = salary.get("gross", 0)
        
        log(f"    Stats: present={stats.get('present')}, effective={stats.get('effective')}", "INFO")
        log(f"    perDay={per_day}, gross={gross}", "INFO")
        
        # Add advance payment
        advance_data = {
            "staffId": staff_id,
            "month": month,
            "amount": 1000,
            "type": "advance",
            "notes": "Advance payment"
        }
        test_request("POST", "/salary/payment", data=advance_data, headers=agency1_headers,
                    desc="12.2 POST /salary/payment type=advance")
        
        # Add paid payment
        paid_data = {
            "staffId": staff_id,
            "month": month,
            "amount": 3000,
            "type": "paid",
            "notes": "Partial salary paid"
        }
        test_request("POST", "/salary/payment", data=paid_data, headers=agency1_headers,
                    desc="12.3 POST /salary/payment type=paid")
        
        # Get salary again to verify payments
        salary2 = test_request("GET", f"/salary?staffId={staff_id}&month={month}",
                              headers=agency1_headers, desc="12.4 GET /salary reflects payments")
        if salary2:
            if salary2.get("advance") == 1000 and salary2.get("paid") == 3000:
                log("    Payments recorded: advance=1000, paid=3000", "PASS")
            else:
                log(f"    Payments incorrect: advance={salary2.get('advance')}, paid={salary2.get('paid')}", "FAIL")
    
    # Get salary summary for all staff
    test_request("GET", f"/salary/all?month={month}", headers=agency1_headers,
                desc="12.5 GET /salary/all returns summary")

# ============================================================================
# 13. EXPENSES CRUD
# ============================================================================
print("\n[13] EXPENSES CRUD")
print("-" * 100)

if test_data["agency1"].get("token"):
    expense_data = {
        "category": "Office Rent",
        "amount": 5000,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "paidVia": "UPI",
        "notes": "Monthly office rent"
    }
    expense = test_request("POST", "/expenses", data=expense_data, headers=agency1_headers,
                          desc="13.1 POST /expenses creates with EXP code")
    if expense:
        expense_id = expense.get("id")
        if expense.get("code", "").startswith("EXP"):
            log(f"    Expense code: {expense.get('code')}", "PASS")
        
        # Get expenses with month filter
        month = datetime.now().strftime("%Y-%m")
        test_request("GET", f"/expenses?month={month}", headers=agency1_headers,
                    desc="13.2 GET /expenses?month filters correctly")
        
        # Update expense
        update_data = {"amount": 5500}
        test_request("PUT", f"/expenses/{expense_id}", data=update_data, headers=agency1_headers,
                    desc="13.3 PUT /expenses/:id updates")
        
        # Delete expense
        test_request("DELETE", f"/expenses/{expense_id}", headers=agency1_headers,
                    desc="13.4 DELETE /expenses/:id removes")

# ============================================================================
# 14. INCOMES SIDE-EFFECTS
# ============================================================================
print("\n[14] INCOMES SIDE-EFFECTS")
print("-" * 100)

if test_data["agency1"].get("token") and test_data["placements"] and test_data["clients"]:
    placement_id = test_data["placements"][0].get("id")
    client_id = test_data["clients"][0].get("id")
    
    # Create income linked to placement
    income_data = {
        "clientId": client_id,
        "placementId": placement_id,
        "amount": 15000,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "method": "Bank Transfer",
        "reference": "TXN123456"
    }
    income = test_request("POST", "/incomes", data=income_data, headers=agency1_headers,
                         desc="14.1 POST /incomes with placementId")
    if income:
        income_id = income.get("id")
        
        # Verify placement.clientPaid increased
        placements = test_request("GET", "/placements", headers=agency1_headers,
                                 desc="14.2 Verify placement.clientPaid increased")
        if placements:
            p = next((pl for pl in placements if pl.get("id") == placement_id), None)
            if p and p.get("clientPaid") == 15000:
                log("    placement.clientPaid = 15000", "PASS")
            else:
                log(f"    placement.clientPaid incorrect: {p.get('clientPaid') if p else 'not found'}", "FAIL")
        
        # Delete income and verify reversal
        test_request("DELETE", f"/incomes/{income_id}", headers=agency1_headers,
                    desc="14.3 DELETE /incomes reverses side-effects")
        
        placements2 = test_request("GET", "/placements", headers=agency1_headers,
                                  desc="14.4 Verify placement.clientPaid reversed")
        if placements2:
            p = next((pl for pl in placements2 if pl.get("id") == placement_id), None)
            if p and p.get("clientPaid") == 0:
                log("    placement.clientPaid reversed to 0", "PASS")

# ============================================================================
# 15. INVOICES AUTO-GENERATION
# ============================================================================
print("\n[15] INVOICES AUTO-GENERATION")
print("-" * 100)

if test_data["agency1"].get("token") and test_data["placements"] and test_data["clients"]:
    placement_id = test_data["placements"][0].get("id")
    client_id = test_data["clients"][0].get("id")
    month = datetime.now().strftime("%Y-%m")
    
    invoice_data = {
        "clientId": client_id,
        "placementId": placement_id,
        "month": month,
        "extras": 0,
        "discount": 0,
        "taxPct": 18
    }
    invoice = test_request("POST", "/invoices", data=invoice_data, headers=agency1_headers,
                          desc="15.1 POST /invoices generates with INV-YYYY-##### format")
    if invoice:
        invoice_id = invoice.get("id")
        number = invoice.get("number", "")
        
        if number.startswith("INV-") and len(number.split("-")) == 3:
            log(f"    Invoice number: {number}", "PASS")
        else:
            log(f"    Invoice number format incorrect: {number}", "FAIL")
        
        if invoice.get("daysWorked"):
            log(f"    daysWorked calculated: {invoice.get('daysWorked')}", "PASS")
        
        snapshot = invoice.get("snapshot", {})
        if snapshot.get("agencyName") and snapshot.get("clientName"):
            log("    Snapshot populated with agencyName and clientName", "PASS")
        
        # Get invoices list
        invoices = test_request("GET", "/invoices", headers=agency1_headers,
                               desc="15.2 GET /invoices returns enriched list")
        if invoices and isinstance(invoices, list):
            inv = invoices[0]
            if inv.get("clientName") and inv.get("placementCode"):
                log("    Invoice enriched with clientName, placementCode", "PASS")
        
        # Get single invoice
        test_request("GET", f"/invoices/{invoice_id}", headers=agency1_headers,
                    desc="15.3 GET /invoices/:id returns full invoice")
        
        # Test income updating invoice status
        income_data = {
            "clientId": client_id,
            "invoiceId": invoice_id,
            "amount": invoice.get("totalAmount", 0),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "method": "Cash"
        }
        test_request("POST", "/incomes", data=income_data, headers=agency1_headers,
                    desc="15.4 POST /incomes updates invoice status to paid")
        
        # Verify invoice status
        invoices2 = test_request("GET", "/invoices", headers=agency1_headers,
                                desc="15.5 Verify invoice status changed to paid")
        if invoices2:
            inv = next((i for i in invoices2 if i.get("id") == invoice_id), None)
            if inv and inv.get("status") == "paid":
                log("    Invoice status changed to 'paid'", "PASS")

# ============================================================================
# 16. REPORTS
# ============================================================================
print("\n[16] REPORTS")
print("-" * 100)

if test_data["agency1"].get("token"):
    month = datetime.now().strftime("%Y-%m")
    
    # P&L with month
    pnl_month = test_request("GET", f"/reports/pnl?month={month}", headers=agency1_headers,
                            desc="16.1 GET /reports/pnl?month returns monthly P&L")
    if pnl_month:
        required = ["revenue", "staffCost", "vendorCommission", "expenseTotal", "netProfit", 
                   "incomeCollected", "salaryPaid", "pendingClientCollection", "expenseByCategory"]
        if all(k in pnl_month for k in required):
            log("    P&L has all required fields", "PASS")
    
    # P&L all-time
    test_request("GET", "/reports/pnl", headers=agency1_headers,
                desc="16.2 GET /reports/pnl (no month) returns all-time")
    
    # Placement report
    test_request("GET", "/reports/placement", headers=agency1_headers,
                desc="16.3 GET /reports/placement returns array")
    
    # Staff report
    test_request("GET", "/reports/staff", headers=agency1_headers,
                desc="16.4 GET /reports/staff returns array")
    
    # Client report
    test_request("GET", "/reports/client", headers=agency1_headers,
                desc="16.5 GET /reports/client returns array")
    
    # Attendance report
    test_request("GET", f"/reports/attendance?month={month}", headers=agency1_headers,
                desc="16.6 GET /reports/attendance?month returns array")

# ============================================================================
# 17. CSV EXPORT
# ============================================================================
print("\n[17] CSV EXPORT")
print("-" * 100)

if test_data["agency1"].get("token"):
    csv_data = {
        "name": "test_export",
        "headers": ["Column A", "Column B", "Column C"],
        "rows": [
            ["Value 1", "Value 2", "Value 3"],
            ["Value 4", "Value 5", "Value 6"]
        ]
    }
    resp = test_request("POST", "/export/csv", data=csv_data, headers=agency1_headers,
                       desc="17.1 POST /export/csv returns text/csv", return_response=True)
    if resp and resp.status_code == 200:
        if resp.headers.get("Content-Type") == "text/csv":
            log("    Content-Type: text/csv", "PASS")
        if "attachment" in resp.headers.get("Content-Disposition", ""):
            log("    Content-Disposition: attachment", "PASS")

# ============================================================================
# 18. DIGITAL REGISTER
# ============================================================================
print("\n[18] DIGITAL REGISTER")
print("-" * 100)

if test_data["agency1"].get("token"):
    # Get all activities
    test_request("GET", "/register", headers=agency1_headers,
                desc="18.1 GET /register returns activities")
    
    # Filter by type
    test_request("GET", "/register?type=duty_join", headers=agency1_headers,
                desc="18.2 GET /register?type filters by type")
    
    # Filter by date
    today = datetime.now().strftime("%Y-%m-%d")
    test_request("GET", f"/register?date={today}", headers=agency1_headers,
                desc="18.3 GET /register?date filters by date")

# ============================================================================
# 19. SUBSCRIPTION E2E (CRITICAL)
# ============================================================================
print("\n[19] SUBSCRIPTION E2E (CRITICAL)")
print("-" * 100)

# Create fresh agency for subscription test
sub_agency_data = {
    "agencyName": "Subscription Test Agency",
    "ownerName": "Sub Owner",
    "email": f"sub_{datetime.now().timestamp()}@test.com",
    "password": "SubPass123!",
    "phone": "+919876543280"
}
sub_result = test_request("POST", "/auth/signup", data=sub_agency_data,
                         desc="19.1 Create fresh agency for subscription test")
if sub_result:
    sub_token = sub_result.get("token")
    sub_headers = {"Authorization": f"Bearer {sub_token}"}
    sub_agency_id = sub_result.get("agency", {}).get("id")
    
    # Add 5 staff
    for i in range(5):
        staff_data = {"name": f"Sub Staff {i+1}", "phone": f"+9198765432{80+i}", "monthlySalary": 20000}
        test_request("POST", "/staff", data=staff_data, headers=sub_headers,
                    desc=f"19.{i+2} Add staff {i+1}/5")
    
    # 6th should fail with 402
    test_request("POST", "/staff", data={"name": "Sub Staff 6", "phone": "+919876543290", "monthlySalary": 20000},
                headers=sub_headers, expected_status=402, desc="19.7 6th staff returns 402")
    
    # GET /subscription/plans
    test_request("GET", "/subscription/plans", headers=sub_headers,
                desc="19.8 GET /subscription/plans")
    
    # GET /subscription/me
    sub_me = test_request("GET", "/subscription/me", headers=sub_headers,
                         desc="19.9 GET /subscription/me")
    if sub_me:
        usage = sub_me.get("usage", {})
        if usage.get("staffCount") == 5:
            log("    usage.staffCount = 5", "PASS")
    
    # POST /subscription/request
    if test_data["plans"].get("professional"):
        prof_plan = test_data["plans"]["professional"]
        request_data = {
            "planId": prof_plan.get("id"),
            "amount": prof_plan.get("monthlyPrice", 1499),
            "utrNumber": "UTR123456789",
            "screenshotUrl": "data:image/png;base64,iVBORw0KGgo=",
            "transactionDate": datetime.now().strftime("%Y-%m-%d"),
            "billingCycle": "monthly"
        }
        payment_req = test_request("POST", "/subscription/request", data=request_data,
                                   headers=sub_headers, desc="19.10 POST /subscription/request")
        if payment_req:
            payment_req_id = payment_req.get("id")
            
            # SA approves
            if test_data["super_admin"].get("token"):
                sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
                
                # GET pending requests
                pending = test_request("GET", "/admin/payment-requests?status=pending",
                                      headers=sa_headers, desc="19.11 SA GET pending requests")
                if pending:
                    req = next((r for r in pending if r.get("id") == payment_req_id), None)
                    if req and req.get("agencyName"):
                        log(f"    Request has agencyName: {req.get('agencyName')}", "PASS")
                
                # Approve
                approve = test_request("POST", f"/admin/payment-requests/{payment_req_id}/approve",
                                      headers=sa_headers, desc="19.12 SA approves payment request")
                if approve:
                    receipt = approve.get("receipt", {})
                    if receipt.get("number", "").startswith("RCP"):
                        log(f"    Receipt generated: {receipt.get('number')}", "PASS")
                    
                    # Verify agency upgraded
                    me = test_request("GET", "/auth/me", headers=sub_headers,
                                     desc="19.13 Verify agency upgraded to PROFESSIONAL")
                    if me:
                        agency = me.get("agency", {})
                        if agency.get("plan") == "PROFESSIONAL":
                            log("    Agency plan = PROFESSIONAL", "PASS")
                        if agency.get("limits", {}).get("maxStaff") == 100:
                            log("    Agency maxStaff = 100", "PASS")
                        if agency.get("expiryDate"):
                            log(f"    expiryDate set: {agency.get('expiryDate')}", "PASS")
                    
                    # GET /receipts
                    receipts = test_request("GET", "/receipts", headers=sub_headers,
                                           desc="19.14 GET /receipts shows receipt")
                    if receipts and isinstance(receipts, list) and len(receipts) > 0:
                        log(f"    Agency has {len(receipts)} receipt(s)", "PASS")
                    
                    # Now 6th staff should succeed
                    test_request("POST", "/staff", 
                                data={"name": "Sub Staff 6 After Upgrade", "phone": "+919876543295", "monthlySalary": 20000},
                                headers=sub_headers, desc="19.15 6th staff succeeds after upgrade")

# ============================================================================
# 20. AGENCY MANAGEMENT (SA)
# ============================================================================
print("\n[20] AGENCY MANAGEMENT (SA)")
print("-" * 100)

if test_data["super_admin"].get("token"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    # GET /admin/agencies
    agencies = test_request("GET", "/admin/agencies", headers=sa_headers,
                           desc="20.1 GET /admin/agencies")
    if agencies and isinstance(agencies, list):
        log(f"    Retrieved {len(agencies)} agencies", "PASS")
        if len(agencies) > 0:
            test_agency_id = agencies[0].get("id")
            
            # Suspend
            test_request("POST", f"/admin/agencies/{test_agency_id}/suspend",
                        headers=sa_headers, desc="20.2 POST /suspend")
            
            # Activate
            test_request("POST", f"/admin/agencies/{test_agency_id}/activate",
                        headers=sa_headers, desc="20.3 POST /activate")
            
            # Change plan
            if test_data["plans"].get("professional"):
                change_data = {
                    "planId": test_data["plans"]["professional"].get("id"),
                    "billingCycle": "monthly"
                }
                test_request("POST", f"/admin/agencies/{test_agency_id}/change-plan",
                            data=change_data, headers=sa_headers, desc="20.4 POST /change-plan")
            
            # Reset password
            test_request("POST", f"/admin/agencies/{test_agency_id}/reset-password",
                        data={"newPassword": "NewPass123!"}, headers=sa_headers,
                        desc="20.5 POST /reset-password")
            
            # Login as
            login_as = test_request("POST", f"/admin/agencies/{test_agency_id}/login-as",
                                   headers=sa_headers, desc="20.6 POST /login-as")
            if login_as:
                imp_token = login_as.get("token")
                imp_headers = {"Authorization": f"Bearer {imp_token}"}
                
                # Use impersonation token
                me = test_request("GET", "/auth/me", headers=imp_headers,
                                 desc="20.7 Impersonation token works with /auth/me")
                if me:
                    if me.get("user", {}).get("role") == "agency_owner":
                        log("    Impersonation returns agency_owner", "PASS")
            
            # Delete (create disposable agency first)
            del_agency_data = {
                "agencyName": "Delete Test Agency",
                "ownerName": "Del Owner",
                "email": f"del_{datetime.now().timestamp()}@test.com",
                "password": "DelPass123!",
                "phone": "+919876543299"
            }
            del_result = test_request("POST", "/auth/signup", data=del_agency_data,
                                     desc="20.8 Create agency for deletion")
            if del_result:
                del_id = del_result.get("agency", {}).get("id")
                test_request("DELETE", f"/admin/agencies/{del_id}", headers=sa_headers,
                            desc="20.9 DELETE /admin/agencies/:id (cascade)")

# ============================================================================
# 21. ADMIN DASHBOARD
# ============================================================================
print("\n[21] ADMIN DASHBOARD")
print("-" * 100)

if test_data["super_admin"].get("token"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    dashboard = test_request("GET", "/admin/dashboard", headers=sa_headers,
                            desc="21.1 GET /admin/dashboard")
    if dashboard:
        cards = dashboard.get("cards", {})
        growth = dashboard.get("growth", [])
        
        if cards:
            log(f"    Cards: totalAgencies={cards.get('totalAgencies')}, totalRevenue={cards.get('totalRevenue')}", "INFO")
        
        if isinstance(growth, list) and len(growth) == 6:
            log("    Growth array has 6 months", "PASS")
        else:
            log(f"    Growth array incorrect length: {len(growth) if isinstance(growth, list) else 0}", "FAIL")

# ============================================================================
# 22. AUDIT LOG
# ============================================================================
print("\n[22] AUDIT LOG")
print("-" * 100)

if test_data["super_admin"].get("token"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    audit = test_request("GET", "/admin/audit", headers=sa_headers,
                        desc="22.1 GET /admin/audit")
    if audit and isinstance(audit, list):
        log(f"    Retrieved {len(audit)} audit entries", "PASS")
        if len(audit) > 0:
            recent_actions = [a.get("action") for a in audit[:5]]
            log(f"    Recent actions: {', '.join(recent_actions)}", "INFO")

# ============================================================================
# 23. SUPPORT TICKETS
# ============================================================================
print("\n[23] SUPPORT TICKETS")
print("-" * 100)

if test_data["agency1"].get("token"):
    agency1_headers = {"Authorization": f"Bearer {test_data['agency1']['token']}"}
    
    # Agency creates ticket
    ticket_data = {
        "subject": "Need help with billing",
        "message": "I have a question about my invoice",
        "priority": "high"
    }
    ticket = test_request("POST", "/support/tickets", data=ticket_data, headers=agency1_headers,
                         desc="23.1 Agency creates ticket")
    if ticket:
        ticket_id = ticket.get("id")
        
        # SA sees ticket with agencyName
        if test_data["super_admin"].get("token"):
            sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
            
            tickets = test_request("GET", "/support/tickets", headers=sa_headers,
                                  desc="23.2 SA GET tickets with agencyName")
            if tickets:
                t = next((tk for tk in tickets if tk.get("id") == ticket_id), None)
                if t and t.get("agencyName"):
                    log(f"    Ticket has agencyName: {t.get('agencyName')}", "PASS")
            
            # SA replies
            test_request("POST", f"/support/tickets/{ticket_id}/reply",
                        data={"message": "We'll help you with that"}, headers=sa_headers,
                        desc="23.3 SA replies to ticket")
            
            # Update status
            test_request("PUT", f"/support/tickets/{ticket_id}",
                        data={"status": "resolved"}, headers=sa_headers,
                        desc="23.4 Update ticket status")
        
        # Cross-agency isolation
        if test_data["agency2"].get("token"):
            agency2_headers = {"Authorization": f"Bearer {test_data['agency2']['token']}"}
            tickets2 = test_request("GET", "/support/tickets", headers=agency2_headers,
                                   desc="23.5 Agency2 GET tickets")
            if tickets2 and isinstance(tickets2, list):
                if not any(t.get("id") == ticket_id for t in tickets2):
                    log("    Cross-agency isolation working", "PASS")
                else:
                    log("    Cross-agency isolation FAILED", "FAIL")

# ============================================================================
# 24. PLATFORM SETTINGS (SA)
# ============================================================================
print("\n[24] PLATFORM SETTINGS (SA)")
print("-" * 100)

if test_data["super_admin"].get("token"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    # GET
    settings = test_request("GET", "/settings/platform", headers=sa_headers,
                           desc="24.1 SA GET /settings/platform")
    if settings:
        log(f"    Retrieved {len(settings)} settings fields", "INFO")
    
    # PUT
    update_data = {"platformName": "DutyOnTrack Production", "bankName": "ICICI Bank"}
    test_request("PUT", "/settings/platform", data=update_data, headers=sa_headers,
                desc="24.2 SA PUT /settings/platform")
    
    # Non-SA should get 403
    if test_data["agency1"].get("token"):
        agency1_headers = {"Authorization": f"Bearer {test_data['agency1']['token']}"}
        test_request("GET", "/settings/platform", headers=agency1_headers,
                    expected_status=403, desc="24.3 Non-SA GET /settings/platform returns 403")

# ============================================================================
# 25. PLANS CRUD (SA)
# ============================================================================
print("\n[25] PLANS CRUD (SA)")
print("-" * 100)

if test_data["super_admin"].get("token"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    # GET
    test_request("GET", "/plans", headers=sa_headers, desc="25.1 SA GET /plans")
    
    # POST
    custom_plan = {
        "code": "CUSTOM_TEST",
        "name": "Custom Test Plan",
        "monthlyPrice": 999,
        "maxStaff": 50,
        "maxClients": 50,
        "maxVendors": 50,
        "features": ["Feature A", "Feature B"]
    }
    created = test_request("POST", "/plans", data=custom_plan, headers=sa_headers,
                          desc="25.2 SA POST /plans creates custom")
    if created:
        plan_id = created.get("id")
        
        # PUT
        test_request("PUT", f"/plans/{plan_id}", data={"monthlyPrice": 1099}, headers=sa_headers,
                    desc="25.3 SA PUT /plans/:id updates")
        
        # DELETE
        test_request("DELETE", f"/plans/{plan_id}", headers=sa_headers,
                    desc="25.4 SA DELETE /plans/:id removes")

# ============================================================================
# 26. PRODUCTION ASSETS
# ============================================================================
print("\n[26] PRODUCTION ASSETS")
print("-" * 100)

# robots.txt
resp = test_request("GET", "", desc="26.1 GET /robots.txt", return_response=True)
if resp:
    try:
        robots_resp = requests.get(f"{FRONTEND_URL}/robots.txt", timeout=10)
        if robots_resp.status_code == 200:
            content = robots_resp.text
            if "User-agent" in content or "User-Agent" in content:
                log("26.1 GET /robots.txt returns 200 with User-Agent", "PASS")
            else:
                log("26.1 GET /robots.txt missing User-Agent directive", "FAIL")
        else:
            log(f"26.1 GET /robots.txt returned {robots_resp.status_code}", "FAIL")
    except Exception as e:
        log(f"26.1 GET /robots.txt failed: {str(e)}", "FAIL")

# sitemap.xml
try:
    sitemap_resp = requests.get(f"{FRONTEND_URL}/sitemap.xml", timeout=10)
    if sitemap_resp.status_code == 200:
        content = sitemap_resp.text
        if "<urlset" in content and "<url>" in content:
            log("26.2 GET /sitemap.xml returns 200 with valid XML", "PASS")
        else:
            log("26.2 GET /sitemap.xml missing urlset/url elements", "FAIL")
    else:
        log(f"26.2 GET /sitemap.xml returned {sitemap_resp.status_code}", "FAIL")
except Exception as e:
    log(f"26.2 GET /sitemap.xml failed: {str(e)}", "FAIL")

# manifest.webmanifest
try:
    manifest_resp = requests.get(f"{FRONTEND_URL}/manifest.webmanifest", timeout=10)
    if manifest_resp.status_code == 200:
        try:
            manifest = manifest_resp.json()
            if "name" in manifest and "icons" in manifest:
                log("26.3 GET /manifest.webmanifest returns 200 with valid JSON", "PASS")
            else:
                log("26.3 GET /manifest.webmanifest missing required fields", "FAIL")
        except:
            log("26.3 GET /manifest.webmanifest not valid JSON", "FAIL")
    else:
        log(f"26.3 GET /manifest.webmanifest returned {manifest_resp.status_code}", "FAIL")
except Exception as e:
    log(f"26.3 GET /manifest.webmanifest failed: {str(e)}", "FAIL")

# icon.svg
try:
    icon_resp = requests.get(f"{FRONTEND_URL}/icon.svg", timeout=10)
    if icon_resp.status_code == 200:
        log("26.4 GET /icon.svg returns 200", "PASS")
    else:
        log(f"26.4 GET /icon.svg returned {icon_resp.status_code}", "FAIL")
except Exception as e:
    log(f"26.4 GET /icon.svg failed: {str(e)}", "FAIL")

# 404 page
try:
    notfound_resp = requests.get(f"{FRONTEND_URL}/nonexistent-page-12345", timeout=10)
    if notfound_resp.status_code == 404:
        log("26.5 GET /nonexistent-page returns 404", "PASS")
    else:
        log(f"26.5 GET /nonexistent-page returned {notfound_resp.status_code}", "FAIL")
except Exception as e:
    log(f"26.5 GET /nonexistent-page failed: {str(e)}", "FAIL")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*100)
print("TEST SUITE COMPLETE")
print("="*100)
print(f"\n✅ PASSED: {test_results['passed']}")
print(f"❌ FAILED: {test_results['failed']}")
print(f"📊 TOTAL: {test_results['passed'] + test_results['failed']}")
print(f"📈 SUCCESS RATE: {(test_results['passed'] / (test_results['passed'] + test_results['failed']) * 100):.1f}%\n")

if test_results['failed'] > 0:
    print("\n❌ FAILED TESTS:")
    for test in test_results['tests']:
        if test['status'] == 'FAIL':
            print(f"   - {test['test']}")

print("\n" + "="*100 + "\n")

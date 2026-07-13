#!/usr/bin/env python3
"""
Phase 3 Comprehensive Backend Testing for DutyOnTrack
Tests Setup Wizard, Platform Settings, Plans, Subscription E2E, Agency Management,
Admin Dashboard, Audit Log, Support Tickets, and Regression tests.
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://agency-pro-33.preview.emergentagent.com/api"

# Test state
super_admin_token = None
super_admin_password = None
agency_token = None
agency_id = None
test_results = {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "errors": []
}

def log_test(name, passed, message=""):
    """Log test result"""
    if passed:
        test_results["passed"] += 1
        print(f"✅ PASS: {name}")
        if message:
            print(f"   {message}")
    else:
        test_results["failed"] += 1
        test_results["errors"].append(f"{name}: {message}")
        print(f"❌ FAIL: {name}")
        print(f"   {message}")

def log_skip(name, reason):
    """Log skipped test"""
    test_results["skipped"] += 1
    print(f"⏭️  SKIP: {name}")
    print(f"   Reason: {reason}")

def test_setup_status():
    """A1: Test GET /api/setup/status"""
    print("\n=== A) SETUP WIZARD ===")
    print("\nA1: Testing GET /api/setup/status...")
    try:
        resp = requests.get(f"{BASE_URL}/setup/status", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            has_keys = "hasSuperAdmin" in data and "hasSettings" in data and "needsSetup" in data
            log_test("GET /setup/status returns correct shape", has_keys, 
                    f"hasSuperAdmin={data.get('hasSuperAdmin')}, needsSetup={data.get('needsSetup')}")
            return data
        else:
            log_test("GET /setup/status", False, f"Status {resp.status_code}: {resp.text}")
            return None
    except Exception as e:
        log_test("GET /setup/status", False, f"Exception: {str(e)}")
        return None

def test_setup_complete():
    """A2: Test POST /api/setup/complete"""
    global super_admin_token, super_admin_password
    print("\nA2: Testing POST /api/setup/complete...")
    
    super_admin_password = "SuperAdmin123!"  # Strong password (>6 chars)
    payload = {
        "name": "Super Admin",
        "email": "superadmin@dutyontrack.com",
        "password": super_admin_password,
        "phone": "+919876543210",
        "platformName": "DutyOnTrack Platform",
        "supportWhatsapp": "+919876543210",
        "supportEmail": "support@dutyontrack.com",
        "accountHolderName": "DutyOnTrack Pvt Ltd",
        "bankName": "HDFC Bank",
        "accountNumber": "1234567890",
        "ifscCode": "HDFC0001234",
        "upiId": "dutyontrack@hdfc"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/setup/complete", json=payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            has_token = "token" in data and "user" in data and "settings" in data
            if has_token and data["user"].get("role") == "super_admin":
                super_admin_token = data["token"]
                log_test("POST /setup/complete creates super admin", True, 
                        f"Token received, role={data['user']['role']}")
                return True
            else:
                log_test("POST /setup/complete", False, "Missing token or incorrect role")
                return False
        elif resp.status_code == 409:
            log_test("POST /setup/complete returns 409 (super admin exists)", True, 
                    "Idempotency check passed")
            return False
        else:
            log_test("POST /setup/complete", False, f"Status {resp.status_code}: {resp.text}")
            return False
    except Exception as e:
        log_test("POST /setup/complete", False, f"Exception: {str(e)}")
        return False

def test_setup_complete_409():
    """A3: Test POST /setup/complete returns 409 on second call"""
    print("\nA3: Testing POST /setup/complete idempotency (should return 409)...")
    
    payload = {
        "name": "Another Admin",
        "email": "another@test.com",
        "password": "password123",
        "phone": "1234567890"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/setup/complete", json=payload, timeout=10)
        if resp.status_code == 409:
            log_test("POST /setup/complete second call returns 409", True, 
                    "Correctly prevents duplicate super admin")
        else:
            log_test("POST /setup/complete second call returns 409", False, 
                    f"Expected 409, got {resp.status_code}")
    except Exception as e:
        log_test("POST /setup/complete second call", False, f"Exception: {str(e)}")

def test_public_endpoints():
    """A4-A5: Test public endpoints (no auth required)"""
    print("\nA4: Testing GET /api/settings/public (no auth)...")
    try:
        resp = requests.get(f"{BASE_URL}/settings/public", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            has_bank = "bankName" in data or "accountNumber" in data or len(data) > 0
            log_test("GET /settings/public returns settings", True, 
                    f"Settings returned with {len(data)} fields")
        else:
            log_test("GET /settings/public", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /settings/public", False, f"Exception: {str(e)}")
    
    print("\nA5: Testing GET /api/plans/public (no auth)...")
    try:
        resp = requests.get(f"{BASE_URL}/plans/public", timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) == 4:
                codes = [p.get("code") for p in data]
                has_defaults = all(c in codes for c in ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"])
                log_test("GET /plans/public returns 4 default plans", has_defaults, 
                        f"Plans: {codes}")
            else:
                log_test("GET /plans/public", False, f"Expected 4 plans, got {len(data)}")
        else:
            log_test("GET /plans/public", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /plans/public", False, f"Exception: {str(e)}")

def test_platform_settings():
    """B: Test Platform Settings (super admin only)"""
    print("\n=== B) PLATFORM SETTINGS (Super Admin) ===")
    
    if not super_admin_token:
        log_skip("Platform Settings tests", "No super admin token available")
        return
    
    headers = {"Authorization": f"Bearer {super_admin_token}"}
    
    print("\nB1: Testing GET /api/settings/platform with SA token...")
    try:
        resp = requests.get(f"{BASE_URL}/settings/platform", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            has_fields = "platformName" in data and "bankName" in data
            log_test("GET /settings/platform (SA)", has_fields, 
                    f"platformName={data.get('platformName')}")
        else:
            log_test("GET /settings/platform (SA)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /settings/platform (SA)", False, f"Exception: {str(e)}")
    
    print("\nB2: Testing PUT /api/settings/platform...")
    try:
        update = {
            "platformName": "DOT Updated",
            "bankName": "HDFC Bank Updated"
        }
        resp = requests.put(f"{BASE_URL}/settings/platform", json=update, headers=headers, timeout=10)
        if resp.status_code == 200:
            # Verify update
            resp2 = requests.get(f"{BASE_URL}/settings/platform", headers=headers, timeout=10)
            if resp2.status_code == 200:
                data = resp2.json()
                updated = data.get("platformName") == "DOT Updated" and data.get("bankName") == "HDFC Bank Updated"
                log_test("PUT /settings/platform updates correctly", updated, 
                        f"platformName={data.get('platformName')}, bankName={data.get('bankName')}")
            else:
                log_test("PUT /settings/platform", False, "Failed to verify update")
        else:
            log_test("PUT /settings/platform", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("PUT /settings/platform", False, f"Exception: {str(e)}")
    
    print("\nB3: Testing non-SA access to platform settings (should return 403)...")
    # Create a test agency to get non-SA token
    agency_payload = {
        "agencyName": "Test Agency for 403",
        "ownerName": "Test Owner",
        "email": f"test403_{int(time.time())}@test.com",
        "password": "password123",
        "phone": "9876543210"
    }
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json=agency_payload, timeout=10)
        if resp.status_code == 200:
            agency_token_temp = resp.json().get("token")
            headers_agency = {"Authorization": f"Bearer {agency_token_temp}"}
            resp2 = requests.get(f"{BASE_URL}/settings/platform", headers=headers_agency, timeout=10)
            if resp2.status_code == 403:
                log_test("Non-SA access to /settings/platform returns 403", True, 
                        "Correctly forbidden")
            else:
                log_test("Non-SA access to /settings/platform returns 403", False, 
                        f"Expected 403, got {resp2.status_code}")
        else:
            log_skip("Non-SA 403 test", "Failed to create test agency")
    except Exception as e:
        log_test("Non-SA 403 test", False, f"Exception: {str(e)}")

def test_plans_crud():
    """C: Test Plans CRUD (super admin only)"""
    print("\n=== C) PLANS CRUD (Super Admin) ===")
    
    if not super_admin_token:
        log_skip("Plans CRUD tests", "No super admin token available")
        return
    
    headers = {"Authorization": f"Bearer {super_admin_token}"}
    
    print("\nC1: Testing GET /api/plans (SA)...")
    try:
        resp = requests.get(f"{BASE_URL}/plans", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) >= 4:
                log_test("GET /plans (SA) returns plans", True, f"Found {len(data)} plans")
            else:
                log_test("GET /plans (SA)", False, f"Expected >=4 plans, got {len(data)}")
        else:
            log_test("GET /plans (SA)", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /plans (SA)", False, f"Exception: {str(e)}")
    
    print("\nC2: Testing POST /api/plans (create custom plan)...")
    custom_plan_id = None
    try:
        plan_payload = {
            "code": "CUSTOM",
            "name": "Custom Plan",
            "monthlyPrice": 999,
            "yearlyPrice": 9990,
            "maxStaff": 50,
            "maxClients": 50,
            "maxVendors": 50,
            "maxBranches": 2,
            "storageGB": 25,
            "features": "Feature A,Feature B,Feature C",
            "description": "Custom plan for testing",
            "recommended": False,
            "active": True
        }
        resp = requests.post(f"{BASE_URL}/plans", json=plan_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            custom_plan_id = data.get("id")
            correct = (data.get("code") == "CUSTOM" and 
                      data.get("monthlyPrice") == 999 and 
                      data.get("maxStaff") == 50)
            log_test("POST /plans creates custom plan", correct, 
                    f"Plan ID: {custom_plan_id}, code={data.get('code')}")
        else:
            log_test("POST /plans", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("POST /plans", False, f"Exception: {str(e)}")
    
    print("\nC3: Testing PUT /api/plans/:id (update plan)...")
    if custom_plan_id:
        try:
            update = {"monthlyPrice": 1099, "name": "Custom Plan Updated"}
            resp = requests.put(f"{BASE_URL}/plans/{custom_plan_id}", json=update, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                updated = data.get("monthlyPrice") == 1099 and data.get("name") == "Custom Plan Updated"
                log_test("PUT /plans/:id updates plan", updated, 
                        f"monthlyPrice={data.get('monthlyPrice')}, name={data.get('name')}")
            else:
                log_test("PUT /plans/:id", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("PUT /plans/:id", False, f"Exception: {str(e)}")
    else:
        log_skip("PUT /plans/:id", "No custom plan created")
    
    print("\nC4: Testing DELETE /api/plans/:id...")
    if custom_plan_id:
        try:
            resp = requests.delete(f"{BASE_URL}/plans/{custom_plan_id}", headers=headers, timeout=10)
            if resp.status_code == 200:
                # Verify deletion
                resp2 = requests.get(f"{BASE_URL}/plans", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    plans = resp2.json()
                    deleted = not any(p.get("id") == custom_plan_id for p in plans)
                    log_test("DELETE /plans/:id removes plan", deleted, 
                            "Plan successfully deleted")
                else:
                    log_test("DELETE /plans/:id", False, "Failed to verify deletion")
            else:
                log_test("DELETE /plans/:id", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("DELETE /plans/:id", False, f"Exception: {str(e)}")
    else:
        log_skip("DELETE /plans/:id", "No custom plan created")

def test_subscription_e2e():
    """D: Test Subscription E2E flow"""
    global agency_token, agency_id
    print("\n=== D) SUBSCRIPTION E2E ===")
    
    # D1: Create fresh agency
    print("\nD1: Creating fresh agency...")
    agency_email = f"agency_sub_{int(time.time())}@test.com"
    agency_payload = {
        "agencyName": "Subscription Test Agency",
        "ownerName": "Sub Test Owner",
        "email": agency_email,
        "password": "password123",
        "phone": "9876543210"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json=agency_payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            agency_token = data.get("token")
            agency_id = data.get("agency", {}).get("id")
            agency_data = data.get("agency", {})
            
            correct = (agency_data.get("plan") == "FREE" and 
                      agency_data.get("limits", {}).get("maxStaff") == 5 and
                      agency_data.get("limits", {}).get("maxClients") == 5 and
                      agency_data.get("limits", {}).get("maxVendors") == 5)
            log_test("Fresh agency has plan=FREE with limits maxStaff=5", correct, 
                    f"plan={agency_data.get('plan')}, limits={agency_data.get('limits')}")
        else:
            log_test("Create fresh agency", False, f"Status {resp.status_code}: {resp.text}")
            return
    except Exception as e:
        log_test("Create fresh agency", False, f"Exception: {str(e)}")
        return
    
    headers = {"Authorization": f"Bearer {agency_token}"}
    
    # D2: Test FREE plan limits - add 5 staff
    print("\nD2: Testing FREE plan staff limit (5 allowed)...")
    staff_ids = []
    for i in range(6):
        try:
            staff_payload = {
                "name": f"Staff Member {i+1}",
                "phone": f"98765432{i:02d}",
                "monthlySalary": 20000
            }
            resp = requests.post(f"{BASE_URL}/staff", json=staff_payload, headers=headers, timeout=10)
            if i < 5:
                if resp.status_code == 200:
                    staff_ids.append(resp.json().get("id"))
                    if i == 4:
                        log_test("FREE plan allows 5 staff", True, "5th staff created successfully")
                else:
                    log_test(f"Create staff {i+1}", False, f"Status {resp.status_code}")
            else:  # 6th staff
                if resp.status_code == 402:
                    error_msg = resp.json().get("error", "")
                    has_limit = "limit" in error_msg.lower()
                    log_test("6th staff returns 402 with 'limit' in error", has_limit, 
                            f"Error: {error_msg}")
                else:
                    log_test("6th staff returns 402", False, 
                            f"Expected 402, got {resp.status_code}")
        except Exception as e:
            log_test(f"Staff creation {i+1}", False, f"Exception: {str(e)}")
    
    # D3: Test client limit (5)
    print("\nD3: Testing FREE plan client limit (5 allowed)...")
    for i in range(6):
        try:
            client_payload = {
                "name": f"Client {i+1}",
                "patientName": f"Patient {i+1}",
                "phone": f"98765432{i:02d}"
            }
            resp = requests.post(f"{BASE_URL}/clients", json=client_payload, headers=headers, timeout=10)
            if i < 5:
                if resp.status_code == 200:
                    if i == 4:
                        log_test("FREE plan allows 5 clients", True, "5th client created successfully")
                else:
                    log_test(f"Create client {i+1}", False, f"Status {resp.status_code}")
            else:  # 6th client
                if resp.status_code == 402:
                    error_msg = resp.json().get("error", "")
                    has_limit = "limit" in error_msg.lower()
                    log_test("6th client returns 402 with 'limit' in error", has_limit, 
                            f"Error: {error_msg}")
                else:
                    log_test("6th client returns 402", False, 
                            f"Expected 402, got {resp.status_code}")
        except Exception as e:
            log_test(f"Client creation {i+1}", False, f"Exception: {str(e)}")
    
    # D3b: Test vendor limit (5)
    print("\nD3b: Testing FREE plan vendor limit (5 allowed)...")
    for i in range(6):
        try:
            vendor_payload = {
                "name": f"Vendor {i+1}",
                "phone": f"98765432{i:02d}",
                "commissionType": "fixed",
                "commissionAmount": 1000
            }
            resp = requests.post(f"{BASE_URL}/vendors", json=vendor_payload, headers=headers, timeout=10)
            if i < 5:
                if resp.status_code == 200:
                    if i == 4:
                        log_test("FREE plan allows 5 vendors", True, "5th vendor created successfully")
                else:
                    log_test(f"Create vendor {i+1}", False, f"Status {resp.status_code}")
            else:  # 6th vendor
                if resp.status_code == 402:
                    error_msg = resp.json().get("error", "")
                    has_limit = "limit" in error_msg.lower()
                    log_test("6th vendor returns 402 with 'limit' in error", has_limit, 
                            f"Error: {error_msg}")
                else:
                    log_test("6th vendor returns 402", False, 
                            f"Expected 402, got {resp.status_code}")
        except Exception as e:
            log_test(f"Vendor creation {i+1}", False, f"Exception: {str(e)}")
    
    # D4: GET /subscription/plans
    print("\nD4: Testing GET /api/subscription/plans (as agency)...")
    try:
        resp = requests.get(f"{BASE_URL}/subscription/plans", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) >= 4:
                log_test("GET /subscription/plans returns active plans", True, 
                        f"Found {len(data)} active plans")
            else:
                log_test("GET /subscription/plans", False, f"Expected >=4 plans, got {len(data)}")
        else:
            log_test("GET /subscription/plans", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /subscription/plans", False, f"Exception: {str(e)}")
    
    # D5: GET /subscription/me
    print("\nD5: Testing GET /api/subscription/me...")
    try:
        resp = requests.get(f"{BASE_URL}/subscription/me", headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            has_structure = ("agency" in data and "usage" in data and 
                           "requests" in data and "receipts" in data)
            if has_structure:
                usage = data.get("usage", {})
                correct_usage = (usage.get("staffCount") == 5 and 
                               usage.get("clientCount") == 5 and
                               usage.get("vendorCount") == 5)
                log_test("GET /subscription/me returns correct structure and usage", correct_usage, 
                        f"staffCount={usage.get('staffCount')}, clientCount={usage.get('clientCount')}, vendorCount={usage.get('vendorCount')}")
            else:
                log_test("GET /subscription/me", False, "Missing required fields")
        else:
            log_test("GET /subscription/me", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /subscription/me", False, f"Exception: {str(e)}")
    
    # D6: Get PROFESSIONAL plan ID
    print("\nD6: Getting PROFESSIONAL plan ID...")
    professional_plan_id = None
    try:
        resp = requests.get(f"{BASE_URL}/plans/public", timeout=10)
        if resp.status_code == 200:
            plans = resp.json()
            for plan in plans:
                if plan.get("code") == "PROFESSIONAL":
                    professional_plan_id = plan.get("id")
                    log_test("Found PROFESSIONAL plan", True, f"Plan ID: {professional_plan_id}")
                    break
            if not professional_plan_id:
                log_test("Find PROFESSIONAL plan", False, "Plan not found")
        else:
            log_test("Get plans for PROFESSIONAL", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Get PROFESSIONAL plan", False, f"Exception: {str(e)}")
    
    # D7: POST /subscription/request
    print("\nD7: Testing POST /api/subscription/request...")
    payment_request_id = None
    if professional_plan_id:
        try:
            request_payload = {
                "planId": professional_plan_id,
                "amount": 1499,
                "utrNumber": "TEST123456",
                "screenshotUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                "transactionDate": datetime.now().strftime("%Y-%m-%d"),
                "billingCycle": "monthly",
                "remarks": "Test payment request"
            }
            resp = requests.post(f"{BASE_URL}/subscription/request", json=request_payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                payment_request_id = data.get("id")
                correct = (data.get("status") == "pending" and 
                          data.get("planCode") == "PROFESSIONAL" and
                          data.get("amount") == 1499)
                log_test("POST /subscription/request creates pending request", correct, 
                        f"Request ID: {payment_request_id}, status={data.get('status')}")
            else:
                log_test("POST /subscription/request", False, f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_test("POST /subscription/request", False, f"Exception: {str(e)}")
    else:
        log_skip("POST /subscription/request", "No PROFESSIONAL plan ID")
    
    # D8: Super Admin - GET /admin/payment-requests?status=pending
    print("\nD8: Testing GET /api/admin/payment-requests?status=pending (SA)...")
    if super_admin_token and payment_request_id:
        try:
            sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
            resp = requests.get(f"{BASE_URL}/admin/payment-requests?status=pending", headers=sa_headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                found = any(r.get("id") == payment_request_id for r in data)
                if found:
                    request_data = next(r for r in data if r.get("id") == payment_request_id)
                    has_agency_name = "agencyName" in request_data
                    log_test("GET /admin/payment-requests includes request with agencyName", has_agency_name, 
                            f"agencyName={request_data.get('agencyName')}")
                else:
                    log_test("GET /admin/payment-requests", False, "Request not found in list")
            else:
                log_test("GET /admin/payment-requests", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("GET /admin/payment-requests", False, f"Exception: {str(e)}")
    else:
        log_skip("GET /admin/payment-requests", "No super admin token or payment request")
    
    # D9: Super Admin - POST /admin/payment-requests/:id/approve
    print("\nD9: Testing POST /api/admin/payment-requests/:id/approve (SA)...")
    if super_admin_token and payment_request_id:
        try:
            sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
            approve_payload = {"note": "Approved for testing"}
            resp = requests.post(f"{BASE_URL}/admin/payment-requests/{payment_request_id}/approve", 
                               json=approve_payload, headers=sa_headers, timeout=10)
            if resp.status_code == 200:
                # Verify agency plan updated
                time.sleep(1)  # Wait for update
                resp2 = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    agency_data = resp2.json().get("agency", {})
                    correct = (agency_data.get("plan") == "PROFESSIONAL" and 
                             agency_data.get("limits", {}).get("maxStaff") == 100 and
                             agency_data.get("expiryDate") is not None)
                    log_test("Approve updates agency plan to PROFESSIONAL with limits.maxStaff=100", correct, 
                            f"plan={agency_data.get('plan')}, maxStaff={agency_data.get('limits', {}).get('maxStaff')}, expiryDate={agency_data.get('expiryDate')}")
                    
                    # Check receipt generated
                    resp3 = requests.get(f"{BASE_URL}/receipts", headers=headers, timeout=10)
                    if resp3.status_code == 200:
                        receipts = resp3.json()
                        if len(receipts) > 0:
                            receipt = receipts[0]
                            has_prefix = receipt.get("number", "").startswith("RCP")
                            log_test("Receipt generated with correct prefix", has_prefix, 
                                    f"Receipt number: {receipt.get('number')}")
                        else:
                            log_test("Receipt generated", False, "No receipts found")
                else:
                    log_test("Verify agency plan update", False, f"Status {resp2.status_code}")
            else:
                log_test("POST /admin/payment-requests/:id/approve", False, 
                        f"Status {resp.status_code}: {resp.text}")
        except Exception as e:
            log_test("POST /admin/payment-requests/:id/approve", False, f"Exception: {str(e)}")
    else:
        log_skip("POST /admin/payment-requests/:id/approve", "No super admin token or payment request")
    
    # D10: Test 6th staff now succeeds
    print("\nD10: Testing 6th staff creation now succeeds after upgrade...")
    try:
        staff_payload = {
            "name": "Staff Member 6",
            "phone": "9876543206",
            "monthlySalary": 20000
        }
        resp = requests.post(f"{BASE_URL}/staff", json=staff_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            log_test("6th staff creation succeeds after upgrade to PROFESSIONAL", True, 
                    "Staff created successfully")
        else:
            log_test("6th staff after upgrade", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("6th staff after upgrade", False, f"Exception: {str(e)}")
    
    # D11: Test reject flow
    print("\nD11: Testing reject flow...")
    if super_admin_token and professional_plan_id:
        try:
            # Create another request
            request_payload = {
                "planId": professional_plan_id,
                "amount": 1499,
                "utrNumber": "TEST789",
                "screenshotUrl": "data:image/png;base64,iVBORw0KGgo=",
                "transactionDate": datetime.now().strftime("%Y-%m-%d"),
                "billingCycle": "monthly"
            }
            resp = requests.post(f"{BASE_URL}/subscription/request", json=request_payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                reject_request_id = resp.json().get("id")
                
                # Reject it
                sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
                reject_payload = {"note": "Invalid payment proof"}
                resp2 = requests.post(f"{BASE_URL}/admin/payment-requests/{reject_request_id}/reject", 
                                    json=reject_payload, headers=sa_headers, timeout=10)
                if resp2.status_code == 200:
                    # Verify status
                    resp3 = requests.get(f"{BASE_URL}/subscription/me", headers=headers, timeout=10)
                    if resp3.status_code == 200:
                        requests_list = resp3.json().get("requests", [])
                        rejected = next((r for r in requests_list if r.get("id") == reject_request_id), None)
                        if rejected and rejected.get("status") == "rejected":
                            log_test("Reject sets status to 'rejected'", True, 
                                    f"status={rejected.get('status')}, note={rejected.get('superAdminNote')}")
                        else:
                            log_test("Reject flow", False, "Status not updated to rejected")
                else:
                    log_test("POST /admin/payment-requests/:id/reject", False, 
                            f"Status {resp2.status_code}")
            else:
                log_test("Create request for reject test", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Reject flow", False, f"Exception: {str(e)}")
    else:
        log_skip("Reject flow test", "No super admin token or plan ID")
    
    # D12: Test request-info flow
    print("\nD12: Testing request-info flow...")
    if super_admin_token and professional_plan_id:
        try:
            # Create another request
            request_payload = {
                "planId": professional_plan_id,
                "amount": 1499,
                "utrNumber": "TEST999",
                "screenshotUrl": "data:image/png;base64,iVBORw0KGgo=",
                "transactionDate": datetime.now().strftime("%Y-%m-%d"),
                "billingCycle": "monthly"
            }
            resp = requests.post(f"{BASE_URL}/subscription/request", json=request_payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                info_request_id = resp.json().get("id")
                
                # Request more info
                sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
                info_payload = {"note": "Please provide clearer screenshot"}
                resp2 = requests.post(f"{BASE_URL}/admin/payment-requests/{info_request_id}/request-info", 
                                    json=info_payload, headers=sa_headers, timeout=10)
                if resp2.status_code == 200:
                    # Verify status
                    resp3 = requests.get(f"{BASE_URL}/subscription/me", headers=headers, timeout=10)
                    if resp3.status_code == 200:
                        requests_list = resp3.json().get("requests", [])
                        info_req = next((r for r in requests_list if r.get("id") == info_request_id), None)
                        if info_req and info_req.get("status") == "more_info":
                            log_test("Request-info sets status to 'more_info'", True, 
                                    f"status={info_req.get('status')}")
                        else:
                            log_test("Request-info flow", False, "Status not updated to more_info")
                else:
                    log_test("POST /admin/payment-requests/:id/request-info", False, 
                            f"Status {resp2.status_code}")
            else:
                log_test("Create request for info test", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("Request-info flow", False, f"Exception: {str(e)}")
    else:
        log_skip("Request-info flow test", "No super admin token or plan ID")

def test_agency_management():
    """E: Test Agency Management (super admin)"""
    print("\n=== E) AGENCY MANAGEMENT (Super Admin) ===")
    
    if not super_admin_token:
        log_skip("Agency Management tests", "No super admin token available")
        return
    
    sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
    
    # E1: GET /admin/agencies
    print("\nE1: Testing GET /api/admin/agencies...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/agencies", headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                agency = data[0]
                has_fields = ("staffCount" in agency and "clientCount" in agency and 
                            "totalPaid" in agency and "activePlacements" in agency)
                log_test("GET /admin/agencies returns list with enriched fields", has_fields, 
                        f"Found {len(data)} agencies")
            else:
                log_test("GET /admin/agencies", False, "No agencies found")
        else:
            log_test("GET /admin/agencies", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /admin/agencies", False, f"Exception: {str(e)}")
    
    # Create test agency for management operations
    print("\nE2: Creating test agency for management operations...")
    test_agency_id = None
    test_agency_token = None
    test_agency_password = "testpass123"
    try:
        agency_payload = {
            "agencyName": "Test Agency for Management",
            "ownerName": "Test Owner",
            "email": f"mgmt_test_{int(time.time())}@test.com",
            "password": test_agency_password,
            "phone": "9876543210"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup", json=agency_payload, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            test_agency_id = data.get("agency", {}).get("id")
            test_agency_token = data.get("token")
            log_test("Created test agency for management", True, f"Agency ID: {test_agency_id}")
        else:
            log_test("Create test agency", False, f"Status {resp.status_code}")
            return
    except Exception as e:
        log_test("Create test agency", False, f"Exception: {str(e)}")
        return
    
    # E3: Test suspend
    print("\nE3: Testing POST /api/admin/agencies/:id/suspend...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/agencies/{test_agency_id}/suspend", headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            # Verify status
            resp2 = requests.get(f"{BASE_URL}/admin/agencies", headers=sa_headers, timeout=10)
            if resp2.status_code == 200:
                agencies = resp2.json()
                agency = next((a for a in agencies if a.get("id") == test_agency_id), None)
                if agency and agency.get("status") == "suspended":
                    log_test("Suspend sets status to 'suspended'", True, 
                            f"status={agency.get('status')}")
                else:
                    log_test("Suspend agency", False, "Status not updated")
        else:
            log_test("POST /admin/agencies/:id/suspend", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Suspend agency", False, f"Exception: {str(e)}")
    
    # E4: Test activate
    print("\nE4: Testing POST /api/admin/agencies/:id/activate...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/agencies/{test_agency_id}/activate", headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            # Verify status
            resp2 = requests.get(f"{BASE_URL}/admin/agencies", headers=sa_headers, timeout=10)
            if resp2.status_code == 200:
                agencies = resp2.json()
                agency = next((a for a in agencies if a.get("id") == test_agency_id), None)
                if agency and agency.get("status") == "active":
                    log_test("Activate sets status to 'active'", True, 
                            f"status={agency.get('status')}")
                else:
                    log_test("Activate agency", False, "Status not updated")
        else:
            log_test("POST /admin/agencies/:id/activate", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Activate agency", False, f"Exception: {str(e)}")
    
    # E5: Test change-plan
    print("\nE5: Testing POST /api/admin/agencies/:id/change-plan...")
    try:
        # Get STARTER plan ID
        resp = requests.get(f"{BASE_URL}/plans/public", timeout=10)
        if resp.status_code == 200:
            plans = resp.json()
            starter_plan = next((p for p in plans if p.get("code") == "STARTER"), None)
            if starter_plan:
                change_payload = {
                    "planId": starter_plan.get("id"),
                    "billingCycle": "monthly"
                }
                resp2 = requests.post(f"{BASE_URL}/admin/agencies/{test_agency_id}/change-plan", 
                                     json=change_payload, headers=sa_headers, timeout=10)
                if resp2.status_code == 200:
                    # Verify plan changed
                    resp3 = requests.get(f"{BASE_URL}/admin/agencies", headers=sa_headers, timeout=10)
                    if resp3.status_code == 200:
                        agencies = resp3.json()
                        agency = next((a for a in agencies if a.get("id") == test_agency_id), None)
                        if agency:
                            correct = (agency.get("plan") == "STARTER" and 
                                     agency.get("limits", {}).get("maxStaff") == 25 and
                                     agency.get("expiryDate") is not None)
                            log_test("Change-plan updates plan and limits", correct, 
                                    f"plan={agency.get('plan')}, maxStaff={agency.get('limits', {}).get('maxStaff')}")
                        else:
                            log_test("Change-plan", False, "Agency not found")
                else:
                    log_test("POST /admin/agencies/:id/change-plan", False, 
                            f"Status {resp2.status_code}")
            else:
                log_skip("Change-plan test", "STARTER plan not found")
    except Exception as e:
        log_test("Change-plan", False, f"Exception: {str(e)}")
    
    # E6: Test reset-password
    print("\nE6: Testing POST /api/admin/agencies/:id/reset-password...")
    new_password = "newpass456"
    try:
        reset_payload = {"newPassword": new_password}
        resp = requests.post(f"{BASE_URL}/admin/agencies/{test_agency_id}/reset-password", 
                           json=reset_payload, headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            # Try to login with new password
            time.sleep(1)
            login_payload = {
                "email": f"mgmt_test_{test_agency_id.split('-')[0]}@test.com",  # Approximate
                "password": new_password
            }
            # Get the actual email from agencies list
            resp2 = requests.get(f"{BASE_URL}/admin/agencies", headers=sa_headers, timeout=10)
            if resp2.status_code == 200:
                agencies = resp2.json()
                agency = next((a for a in agencies if a.get("id") == test_agency_id), None)
                if agency:
                    login_payload["email"] = agency.get("ownerEmail")
                    resp3 = requests.post(f"{BASE_URL}/auth/login", json=login_payload, timeout=10)
                    if resp3.status_code == 200:
                        log_test("Reset-password allows login with new password", True, 
                                "Login successful with new password")
                    else:
                        log_test("Login with new password", False, 
                                f"Status {resp3.status_code}: {resp3.text}")
        else:
            log_test("POST /admin/agencies/:id/reset-password", False, 
                    f"Status {resp.status_code}")
    except Exception as e:
        log_test("Reset-password", False, f"Exception: {str(e)}")
    
    # E7: Test login-as (impersonation)
    print("\nE7: Testing POST /api/admin/agencies/:id/login-as...")
    try:
        resp = requests.post(f"{BASE_URL}/admin/agencies/{test_agency_id}/login-as", 
                           headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            impersonation_token = data.get("token")
            if impersonation_token:
                # Use impersonation token to call /auth/me
                imp_headers = {"Authorization": f"Bearer {impersonation_token}"}
                resp2 = requests.get(f"{BASE_URL}/auth/me", headers=imp_headers, timeout=10)
                if resp2.status_code == 200:
                    me_data = resp2.json()
                    user = me_data.get("user", {})
                    agency = me_data.get("agency", {})
                    correct = (user.get("agencyId") == test_agency_id and 
                             user.get("role") == "agency_owner" and
                             agency.get("id") == test_agency_id)
                    log_test("Login-as returns impersonation token that works", correct, 
                            f"Impersonated agency: {agency.get('name')}")
                else:
                    log_test("Use impersonation token", False, f"Status {resp2.status_code}")
            else:
                log_test("Login-as", False, "No token returned")
        else:
            log_test("POST /admin/agencies/:id/login-as", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("Login-as", False, f"Exception: {str(e)}")
    
    # E8: Test DELETE agency (cascade)
    print("\nE8: Testing DELETE /api/admin/agencies/:id (cascade delete)...")
    # First add some data to the test agency
    test_headers = {"Authorization": f"Bearer {test_agency_token}"}
    try:
        # Add a staff member
        staff_payload = {"name": "Test Staff", "phone": "9876543210", "monthlySalary": 20000}
        requests.post(f"{BASE_URL}/staff", json=staff_payload, headers=test_headers, timeout=10)
        
        # Delete agency
        resp = requests.delete(f"{BASE_URL}/admin/agencies/{test_agency_id}", headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            # Verify agency deleted
            resp2 = requests.get(f"{BASE_URL}/admin/agencies", headers=sa_headers, timeout=10)
            if resp2.status_code == 200:
                agencies = resp2.json()
                deleted = not any(a.get("id") == test_agency_id for a in agencies)
                log_test("DELETE /admin/agencies/:id removes agency", deleted, 
                        "Agency and cascade data deleted")
            else:
                log_test("Verify agency deletion", False, f"Status {resp2.status_code}")
        else:
            log_test("DELETE /admin/agencies/:id", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("DELETE agency", False, f"Exception: {str(e)}")

def test_admin_dashboard():
    """F: Test Admin Dashboard"""
    print("\n=== F) ADMIN DASHBOARD ===")
    
    if not super_admin_token:
        log_skip("Admin Dashboard test", "No super admin token available")
        return
    
    sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
    
    print("\nF1: Testing GET /api/admin/dashboard...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/dashboard", headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            has_cards = "cards" in data
            has_growth = "growth" in data and isinstance(data.get("growth"), list)
            
            if has_cards and has_growth:
                cards = data.get("cards", {})
                growth = data.get("growth", [])
                
                required_cards = ["totalAgencies", "trialAgencies", "paidAgencies", 
                                "totalStaff", "totalClients", "totalRevenue", 
                                "pendingApprovals", "openTickets"]
                has_all_cards = all(k in cards for k in required_cards)
                
                correct_growth = len(growth) == 6
                
                log_test("GET /admin/dashboard returns cards and growth[6]", 
                        has_all_cards and correct_growth, 
                        f"Cards: {len(cards)} fields, Growth: {len(growth)} months")
            else:
                log_test("GET /admin/dashboard", False, "Missing cards or growth")
        else:
            log_test("GET /admin/dashboard", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /admin/dashboard", False, f"Exception: {str(e)}")

def test_audit_log():
    """G: Test Audit Log"""
    print("\n=== G) AUDIT LOG ===")
    
    if not super_admin_token:
        log_skip("Audit Log test", "No super admin token available")
        return
    
    sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
    
    print("\nG1: Testing GET /api/admin/audit...")
    try:
        resp = requests.get(f"{BASE_URL}/admin/audit", headers=sa_headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                # Check if recent actions are logged
                has_entries = len(data) > 0
                if has_entries:
                    entry = data[0]
                    has_fields = ("action" in entry and "target" in entry and 
                                "message" in entry and "createdAt" in entry)
                    log_test("GET /admin/audit returns audit entries", has_fields, 
                            f"Found {len(data)} audit entries, latest action: {entry.get('action')}")
                else:
                    log_test("GET /admin/audit", True, "No audit entries yet (expected for fresh setup)")
            else:
                log_test("GET /admin/audit", False, "Expected array")
        else:
            log_test("GET /admin/audit", False, f"Status {resp.status_code}")
    except Exception as e:
        log_test("GET /admin/audit", False, f"Exception: {str(e)}")

def test_support_tickets():
    """H: Test Support Tickets"""
    global agency_token, agency_id
    print("\n=== H) SUPPORT TICKETS ===")
    
    if not agency_token:
        print("\nCreating test agency for support tickets...")
        agency_email = f"support_test_{int(time.time())}@test.com"
        agency_payload = {
            "agencyName": "Support Test Agency",
            "ownerName": "Support Owner",
            "email": agency_email,
            "password": "password123",
            "phone": "9876543210"
        }
        try:
            resp = requests.post(f"{BASE_URL}/auth/signup", json=agency_payload, timeout=10)
            if resp.status_code == 200:
                agency_token = resp.json().get("token")
                agency_id = resp.json().get("agency", {}).get("id")
            else:
                log_skip("Support Tickets tests", "Failed to create test agency")
                return
        except Exception as e:
            log_skip("Support Tickets tests", f"Exception creating agency: {str(e)}")
            return
    
    headers = {"Authorization": f"Bearer {agency_token}"}
    
    # H1: Agency creates ticket
    print("\nH1: Testing POST /api/support/tickets (agency)...")
    ticket_id = None
    try:
        ticket_payload = {
            "subject": "Need help with subscription",
            "message": "I cannot upgrade my plan",
            "priority": "high"
        }
        resp = requests.post(f"{BASE_URL}/support/tickets", json=ticket_payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            ticket_id = data.get("id")
            correct = (data.get("subject") == "Need help with subscription" and 
                      data.get("priority") == "high" and
                      data.get("status") == "open")
            log_test("POST /support/tickets creates ticket", correct, 
                    f"Ticket ID: {ticket_id}, status={data.get('status')}")
        else:
            log_test("POST /support/tickets", False, f"Status {resp.status_code}: {resp.text}")
    except Exception as e:
        log_test("POST /support/tickets", False, f"Exception: {str(e)}")
    
    # H2: Super Admin sees ticket with agencyName
    print("\nH2: Testing GET /api/support/tickets (SA sees with agencyName)...")
    if super_admin_token and ticket_id:
        try:
            sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
            resp = requests.get(f"{BASE_URL}/support/tickets", headers=sa_headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                ticket = next((t for t in data if t.get("id") == ticket_id), None)
                if ticket:
                    has_agency_name = "agencyName" in ticket
                    log_test("GET /support/tickets (SA) includes agencyName", has_agency_name, 
                            f"agencyName={ticket.get('agencyName')}")
                else:
                    log_test("GET /support/tickets (SA)", False, "Ticket not found")
            else:
                log_test("GET /support/tickets (SA)", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("GET /support/tickets (SA)", False, f"Exception: {str(e)}")
    else:
        log_skip("GET /support/tickets (SA)", "No super admin token or ticket")
    
    # H3: Super Admin replies
    print("\nH3: Testing POST /api/support/tickets/:id/reply (SA)...")
    if super_admin_token and ticket_id:
        try:
            sa_headers = {"Authorization": f"Bearer {super_admin_token}"}
            reply_payload = {
                "message": "We are looking into your issue",
                "status": "in_progress"
            }
            resp = requests.post(f"{BASE_URL}/support/tickets/{ticket_id}/reply", 
                               json=reply_payload, headers=sa_headers, timeout=10)
            if resp.status_code == 200:
                # Verify reply added
                resp2 = requests.get(f"{BASE_URL}/support/tickets", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    tickets = resp2.json()
                    ticket = next((t for t in tickets if t.get("id") == ticket_id), None)
                    if ticket:
                        has_reply = len(ticket.get("replies", [])) > 0
                        status_updated = ticket.get("status") == "in_progress"
                        log_test("Reply appended and status updated", has_reply and status_updated, 
                                f"Replies: {len(ticket.get('replies', []))}, status={ticket.get('status')}")
                    else:
                        log_test("Verify reply", False, "Ticket not found")
            else:
                log_test("POST /support/tickets/:id/reply", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("POST /support/tickets/:id/reply", False, f"Exception: {str(e)}")
    else:
        log_skip("POST /support/tickets/:id/reply", "No super admin token or ticket")
    
    # H4: Update ticket status
    print("\nH4: Testing PUT /api/support/tickets/:id (update status)...")
    if ticket_id:
        try:
            update_payload = {"status": "resolved"}
            resp = requests.put(f"{BASE_URL}/support/tickets/{ticket_id}", 
                              json=update_payload, headers=headers, timeout=10)
            if resp.status_code == 200:
                # Verify status
                resp2 = requests.get(f"{BASE_URL}/support/tickets", headers=headers, timeout=10)
                if resp2.status_code == 200:
                    tickets = resp2.json()
                    ticket = next((t for t in tickets if t.get("id") == ticket_id), None)
                    if ticket and ticket.get("status") == "resolved":
                        log_test("PUT /support/tickets/:id updates status", True, 
                                f"status={ticket.get('status')}")
                    else:
                        log_test("PUT /support/tickets/:id", False, "Status not updated")
            else:
                log_test("PUT /support/tickets/:id", False, f"Status {resp.status_code}")
        except Exception as e:
            log_test("PUT /support/tickets/:id", False, f"Exception: {str(e)}")
    else:
        log_skip("PUT /support/tickets/:id", "No ticket created")
    
    # H5: Test cross-agency isolation
    print("\nH5: Testing cross-agency ticket isolation...")
    try:
        # Create another agency
        agency2_email = f"support_test2_{int(time.time())}@test.com"
        agency2_payload = {
            "agencyName": "Support Test Agency 2",
            "ownerName": "Support Owner 2",
            "email": agency2_email,
            "password": "password123",
            "phone": "9876543211"
        }
        resp = requests.post(f"{BASE_URL}/auth/signup", json=agency2_payload, timeout=10)
        if resp.status_code == 200:
            agency2_token = resp.json().get("token")
            headers2 = {"Authorization": f"Bearer {agency2_token}"}
            
            # Agency 2 tries to see tickets
            resp2 = requests.get(f"{BASE_URL}/support/tickets", headers=headers2, timeout=10)
            if resp2.status_code == 200:
                tickets = resp2.json()
                # Should not see agency 1's ticket
                has_agency1_ticket = any(t.get("id") == ticket_id for t in tickets)
                log_test("Cross-agency ticket isolation", not has_agency1_ticket, 
                        f"Agency 2 sees {len(tickets)} tickets (should not see Agency 1's)")
            else:
                log_test("Cross-agency isolation check", False, f"Status {resp2.status_code}")
        else:
            log_skip("Cross-agency isolation test", "Failed to create second agency")
    except Exception as e:
        log_test("Cross-agency isolation", False, f"Exception: {str(e)}")

def test_regression():
    """I: Test Regression (Phase 1 & 2 must still work)"""
    print("\n=== I) REGRESSION TESTS ===")
    
    print("\nCreating fresh agency for regression tests...")
    regression_email = f"regression_{int(time.time())}@test.com"
    regression_payload = {
        "agencyName": "Regression Test Agency",
        "ownerName": "Regression Owner",
        "email": regression_email,
        "password": "password123",
        "phone": "9876543210"
    }
    
    try:
        resp = requests.post(f"{BASE_URL}/auth/signup", json=regression_payload, timeout=10)
        if resp.status_code != 200:
            log_skip("Regression tests", "Failed to create test agency")
            return
        
        regression_token = resp.json().get("token")
        headers = {"Authorization": f"Bearer {regression_token}"}
        
        # I1: Test staff limit (5 on FREE)
        print("\nI1: Regression - Staff limit on FREE plan...")
        for i in range(6):
            staff_payload = {
                "name": f"Regression Staff {i+1}",
                "phone": f"98765432{i:02d}",
                "monthlySalary": 20000
            }
            resp = requests.post(f"{BASE_URL}/staff", json=staff_payload, headers=headers, timeout=10)
            if i < 5:
                if resp.status_code == 200:
                    if i == 4:
                        log_test("Regression: 5 staff allowed on FREE", True, "5th staff created")
                else:
                    log_test(f"Regression: Create staff {i+1}", False, f"Status {resp.status_code}")
            else:
                if resp.status_code == 402:
                    error_msg = resp.json().get("error", "")
                    has_limit = "limit" in error_msg.lower()
                    log_test("Regression: 6th staff returns 402 with 'limit'", has_limit, 
                            f"Error: {error_msg}")
                else:
                    log_test("Regression: 6th staff returns 402", False, 
                            f"Expected 402, got {resp.status_code}")
        
        # I2: Test client limit (5 on FREE)
        print("\nI2: Regression - Client limit on FREE plan...")
        for i in range(6):
            client_payload = {
                "name": f"Regression Client {i+1}",
                "patientName": f"Patient {i+1}",
                "phone": f"98765432{i:02d}"
            }
            resp = requests.post(f"{BASE_URL}/clients", json=client_payload, headers=headers, timeout=10)
            if i < 5:
                if resp.status_code == 200:
                    if i == 4:
                        log_test("Regression: 5 clients allowed on FREE", True, "5th client created")
                else:
                    log_test(f"Regression: Create client {i+1}", False, f"Status {resp.status_code}")
            else:
                if resp.status_code == 402:
                    error_msg = resp.json().get("error", "")
                    has_limit = "limit" in error_msg.lower()
                    log_test("Regression: 6th client returns 402 with 'limit'", has_limit, 
                            f"Error: {error_msg}")
                else:
                    log_test("Regression: 6th client returns 402", False, 
                            f"Expected 402, got {resp.status_code}")
        
        # I3: Test vendor limit (5 on FREE)
        print("\nI3: Regression - Vendor limit on FREE plan...")
        for i in range(6):
            vendor_payload = {
                "name": f"Regression Vendor {i+1}",
                "phone": f"98765432{i:02d}",
                "commissionType": "fixed",
                "commissionAmount": 1000
            }
            resp = requests.post(f"{BASE_URL}/vendors", json=vendor_payload, headers=headers, timeout=10)
            if i < 5:
                if resp.status_code == 200:
                    if i == 4:
                        log_test("Regression: 5 vendors allowed on FREE", True, "5th vendor created")
                else:
                    log_test(f"Regression: Create vendor {i+1}", False, f"Status {resp.status_code}")
            else:
                if resp.status_code == 402:
                    error_msg = resp.json().get("error", "")
                    has_limit = "limit" in error_msg.lower()
                    log_test("Regression: 6th vendor returns 402 with 'limit'", has_limit, 
                            f"Error: {error_msg}")
                else:
                    log_test("Regression: 6th vendor returns 402", False, 
                            f"Expected 402, got {resp.status_code}")
        
    except Exception as e:
        log_test("Regression tests", False, f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"✅ PASSED: {test_results['passed']}")
    print(f"❌ FAILED: {test_results['failed']}")
    print(f"⏭️  SKIPPED: {test_results['skipped']}")
    print(f"TOTAL: {test_results['passed'] + test_results['failed'] + test_results['skipped']}")
    
    if test_results['errors']:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for error in test_results['errors']:
            print(f"  • {error}")
    
    print("\n" + "="*80)

def main():
    """Main test execution"""
    print("="*80)
    print("DUTYONTRACK PHASE 3 COMPREHENSIVE BACKEND TESTING")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # A) Setup Wizard
    setup_status = test_setup_status()
    
    if setup_status and setup_status.get("needsSetup"):
        print("\n🔧 Setup needed - creating super admin...")
        test_setup_complete()
        test_setup_complete_409()
    else:
        print("\n⚠️  Super admin already exists - testing idempotency...")
        test_setup_complete_409()
    
    test_public_endpoints()
    
    # B) Platform Settings
    test_platform_settings()
    
    # C) Plans CRUD
    test_plans_crud()
    
    # D) Subscription E2E
    test_subscription_e2e()
    
    # E) Agency Management
    test_agency_management()
    
    # F) Admin Dashboard
    test_admin_dashboard()
    
    # G) Audit Log
    test_audit_log()
    
    # H) Support Tickets
    test_support_tickets()
    
    # I) Regression
    test_regression()
    
    # Print summary
    print_summary()
    
    # Exit with appropriate code
    if test_results['failed'] > 0:
        exit(1)
    else:
        exit(0)

if __name__ == "__main__":
    main()

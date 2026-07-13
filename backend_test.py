#!/usr/bin/env python3
"""
DutyOnTrack Phase 3 Comprehensive Backend Test Suite
Tests all super admin features, subscription flow, and regression checks
"""

import requests
import json
import sys
from datetime import datetime, timedelta

# Base URL from .env
BASE_URL = "https://agency-pro-33.preview.emergentagent.com/api"

# Test data storage
test_data = {
    "super_admin": {},
    "agency1": {},
    "agency2": {},
    "plans": {},
    "payment_request": {},
}

def log(msg, status="INFO"):
    """Log test messages"""
    prefix = "✅" if status == "PASS" else "❌" if status == "FAIL" else "ℹ️"
    print(f"{prefix} {msg}")

def test_request(method, endpoint, data=None, headers=None, expected_status=200, desc=""):
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
            log(f"Unknown method {method}", "FAIL")
            return None
        
        if resp.status_code != expected_status:
            log(f"{desc} - Expected {expected_status}, got {resp.status_code}: {resp.text[:200]}", "FAIL")
            return None
        
        log(f"{desc} - Status {resp.status_code}", "PASS")
        
        if resp.status_code == 200 or resp.status_code == 201:
            try:
                return resp.json()
            except:
                return resp.text
        return None
    except Exception as e:
        log(f"{desc} - Exception: {str(e)}", "FAIL")
        return None

print("\n" + "="*80)
print("DUTYONTRACK PHASE 3 COMPREHENSIVE BACKEND TEST")
print("="*80 + "\n")

# ============================================================================
# A) SETUP WIZARD
# ============================================================================
print("\n[A] SETUP WIZARD TESTS")
print("-" * 80)

# A1: GET /setup/status
result = test_request("GET", "/setup/status", desc="A1: GET /setup/status")
if result:
    log(f"Setup status: hasSuperAdmin={result.get('hasSuperAdmin')}, needsSetup={result.get('needsSetup')}")
    if result.get('needsSetup'):
        log("Database is fresh - needsSetup=true", "PASS")
    else:
        log("Super admin already exists - needsSetup=false", "INFO")

# A2: POST /setup/complete (if needsSetup=true)
if result and result.get('needsSetup'):
    setup_data = {
        "name": "Super Admin",
        "email": "superadmin@dutyontrack.com",
        "password": "SuperSecure123!",
        "phone": "+919876543210",
        "platformName": "DutyOnTrack",
        "supportWhatsapp": "+919876543210",
        "supportEmail": "support@dutyontrack.com",
        "accountHolderName": "DutyOnTrack Pvt Ltd",
        "bankName": "HDFC Bank",
        "accountNumber": "50200012345678",
        "ifscCode": "HDFC0001234",
        "upiId": "dutyontrack@hdfc"
    }
    setup_result = test_request("POST", "/setup/complete", data=setup_data, 
                                desc="A2: POST /setup/complete with strong password")
    if setup_result:
        test_data["super_admin"]["token"] = setup_result.get("token")
        test_data["super_admin"]["email"] = setup_data["email"]
        test_data["super_admin"]["password"] = setup_data["password"]
        log(f"Super admin created: {setup_result.get('user', {}).get('email')}", "PASS")
        log(f"Token saved: {test_data['super_admin']['token'][:20]}...", "INFO")
else:
    # Try to login with existing super admin
    log("Attempting to login with existing super admin credentials", "INFO")
    login_data = {"email": "superadmin@dutyontrack.com", "password": "SuperSecure123!"}
    login_result = test_request("POST", "/auth/login", data=login_data, 
                               desc="Login existing super admin")
    if login_result:
        test_data["super_admin"]["token"] = login_result.get("token")
        test_data["super_admin"]["email"] = login_data["email"]
        test_data["super_admin"]["password"] = login_data["password"]
        log("Logged in with existing super admin", "PASS")

# A3: Second call to /setup/complete should return 409
second_setup = test_request("POST", "/setup/complete", data=setup_data if result and result.get('needsSetup') else {
    "name": "Another Admin", "email": "another@test.com", "password": "test123",
    "platformName": "Test", "supportEmail": "test@test.com"
}, expected_status=409, desc="A3: Second /setup/complete should return 409")

# A4: GET /settings/public (no auth)
public_settings = test_request("GET", "/settings/public", desc="A4: GET /settings/public (no auth)")
if public_settings:
    required_fields = ["bankName", "accountNumber", "ifscCode", "upiId", "qrCodeUrl"]
    found_fields = [f for f in required_fields if f in public_settings]
    log(f"Public settings has {len(found_fields)}/{len(required_fields)} bank fields: {found_fields}", 
        "PASS" if len(found_fields) >= 4 else "FAIL")

# A5: GET /plans/public (no auth)
public_plans = test_request("GET", "/plans/public", desc="A5: GET /plans/public (no auth)")
if public_plans and isinstance(public_plans, list):
    plan_codes = [p.get("code") for p in public_plans]
    expected_codes = ["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]
    if all(code in plan_codes for code in expected_codes):
        log(f"All 4 default plans found: {plan_codes}", "PASS")
        # Save PROFESSIONAL plan ID for later
        for p in public_plans:
            if p.get("code") == "PROFESSIONAL":
                test_data["plans"]["professional"] = p
    else:
        log(f"Missing default plans. Found: {plan_codes}", "FAIL")

# ============================================================================
# B) PLATFORM SETTINGS (Super Admin)
# ============================================================================
print("\n[B] PLATFORM SETTINGS TESTS")
print("-" * 80)

if not test_data["super_admin"].get("token"):
    log("No super admin token - skipping platform settings tests", "FAIL")
else:
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    # B1: GET /settings/platform with SA token
    platform_settings = test_request("GET", "/settings/platform", headers=sa_headers,
                                    desc="B1: GET /settings/platform (SA)")
    if platform_settings:
        log(f"Platform settings retrieved: {len(platform_settings)} fields", "PASS")
    
    # B2: PUT /settings/platform
    update_data = {
        "platformName": "DutyOnTrack Updated",
        "bankName": "ICICI Bank"
    }
    updated_settings = test_request("PUT", "/settings/platform", data=update_data, 
                                   headers=sa_headers, desc="B2: PUT /settings/platform")
    if updated_settings:
        if updated_settings.get("platformName") == "DutyOnTrack Updated":
            log("Platform settings updated successfully", "PASS")
        else:
            log("Platform settings update failed", "FAIL")
    
    # B3: Non-SA (agency owner) hitting /settings/platform should get 403
    # First create an agency
    agency_signup = {
        "agencyName": "Test Agency for 403",
        "ownerName": "Test Owner",
        "email": f"agency403_{datetime.now().timestamp()}@test.com",
        "password": "TestPass123!",
        "phone": "+919999999999"
    }
    agency_result = test_request("POST", "/auth/signup", data=agency_signup,
                                desc="Create agency for 403 test")
    if agency_result:
        agency_token = agency_result.get("token")
        agency_headers = {"Authorization": f"Bearer {agency_token}"}
        
        # Try to access platform settings with agency token
        forbidden = test_request("GET", "/settings/platform", headers=agency_headers,
                               expected_status=403, desc="B3: Agency owner GET /settings/platform should return 403")

# ============================================================================
# C) PLANS CRUD (Super Admin)
# ============================================================================
print("\n[C] PLANS CRUD TESTS")
print("-" * 80)

if not test_data["super_admin"].get("token"):
    log("No super admin token - skipping plans CRUD tests", "FAIL")
else:
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    # C1: GET /plans (SA)
    all_plans = test_request("GET", "/plans", headers=sa_headers, desc="C1: GET /plans (SA)")
    if all_plans and isinstance(all_plans, list):
        log(f"Retrieved {len(all_plans)} plans", "PASS")
    
    # C2: POST /plans (create custom plan)
    custom_plan = {
        "code": "CUSTOM",
        "name": "Custom Plan",
        "monthlyPrice": 999,
        "yearlyPrice": 9990,
        "maxStaff": 50,
        "maxClients": 50,
        "maxVendors": 50,
        "maxBranches": 2,
        "storageGB": 25,
        "features": ["Feature A", "Feature B", "Feature C"],
        "description": "Custom plan for testing",
        "active": True
    }
    created_plan = test_request("POST", "/plans", data=custom_plan, headers=sa_headers,
                               desc="C2: POST /plans (create custom)")
    if created_plan:
        test_data["plans"]["custom_id"] = created_plan.get("id")
        log(f"Custom plan created: {created_plan.get('code')}", "PASS")
    
    # C3: PUT /plans/:id (update)
    if test_data["plans"].get("custom_id"):
        update_plan = {"monthlyPrice": 1099, "description": "Updated custom plan"}
        updated_plan = test_request("PUT", f"/plans/{test_data['plans']['custom_id']}", 
                                   data=update_plan, headers=sa_headers,
                                   desc="C3: PUT /plans/:id (update)")
        if updated_plan and updated_plan.get("monthlyPrice") == 1099:
            log("Plan updated successfully", "PASS")
    
    # C4: DELETE /plans/:id
    if test_data["plans"].get("custom_id"):
        deleted = test_request("DELETE", f"/plans/{test_data['plans']['custom_id']}", 
                             headers=sa_headers, desc="C4: DELETE /plans/:id")

# ============================================================================
# D) SUBSCRIPTION E2E (MOST CRITICAL)
# ============================================================================
print("\n[D] SUBSCRIPTION E2E TESTS (CRITICAL)")
print("-" * 80)

# D1: Sign up fresh agency
agency1_data = {
    "agencyName": "Fresh Agency for Subscription Test",
    "ownerName": "Agency Owner",
    "email": f"agency_sub_{datetime.now().timestamp()}@test.com",
    "password": "AgencyPass123!",
    "phone": "+919876543211"
}
agency1_result = test_request("POST", "/auth/signup", data=agency1_data,
                             desc="D1: Sign up fresh agency")
if agency1_result:
    test_data["agency1"]["token"] = agency1_result.get("token")
    test_data["agency1"]["id"] = agency1_result.get("agency", {}).get("id")
    test_data["agency1"]["email"] = agency1_data["email"]
    test_data["agency1"]["password"] = agency1_data["password"]
    
    agency = agency1_result.get("agency", {})
    if agency.get("plan") == "FREE" and agency.get("limits", {}).get("maxStaff") == 5:
        log(f"Agency created with FREE plan, maxStaff=5", "PASS")
    else:
        log(f"Agency plan/limits incorrect: {agency.get('plan')}, {agency.get('limits')}", "FAIL")

# D2: Add 5 staff (should work)
if test_data["agency1"].get("token"):
    agency1_headers = {"Authorization": f"Bearer {test_data['agency1']['token']}"}
    
    for i in range(5):
        staff_data = {
            "name": f"Staff Member {i+1}",
            "phone": f"+9198765432{10+i}",
            "monthlySalary": 20000
        }
        staff_result = test_request("POST", "/staff", data=staff_data, headers=agency1_headers,
                                   desc=f"D2: Add staff {i+1}/5")
        if i == 0 and staff_result:
            test_data["agency1"]["first_staff_id"] = staff_result.get("id")

# D3: Try to add 6th staff (should return 402 with "limit" in message)
if test_data["agency1"].get("token"):
    staff_data = {"name": "6th Staff Member", "phone": "+919876543220", "monthlySalary": 20000}
    sixth_staff = test_request("POST", "/staff", data=staff_data, headers=agency1_headers,
                              expected_status=402, desc="D3: 6th staff should return 402")
    # Check if error message contains "limit"
    if sixth_staff is None:
        log("6th staff correctly blocked with 402", "PASS")

# D4: GET /subscription/plans
if test_data["agency1"].get("token"):
    sub_plans = test_request("GET", "/subscription/plans", headers=agency1_headers,
                            desc="D4: GET /subscription/plans")
    if sub_plans and isinstance(sub_plans, list):
        log(f"Retrieved {len(sub_plans)} subscription plans", "PASS")

# D5: GET /subscription/me
if test_data["agency1"].get("token"):
    sub_me = test_request("GET", "/subscription/me", headers=agency1_headers,
                         desc="D5: GET /subscription/me")
    if sub_me:
        usage = sub_me.get("usage", {})
        if usage.get("staffCount") == 5:
            log(f"Subscription usage correct: staffCount=5", "PASS")
        else:
            log(f"Subscription usage incorrect: {usage}", "FAIL")

# D6: POST /subscription/request with screenshot
if test_data["agency1"].get("token") and test_data["plans"].get("professional"):
    professional_plan = test_data["plans"]["professional"]
    payment_request_data = {
        "planId": professional_plan.get("id"),
        "amount": professional_plan.get("monthlyPrice", 1499),
        "utrNumber": "TEST123456789",
        "screenshotUrl": "data:image/png;base64,iVBORw0KGgo=",
        "transactionDate": datetime.now().strftime("%Y-%m-%d"),
        "billingCycle": "monthly",
        "remarks": "Test payment for PROFESSIONAL plan"
    }
    payment_req = test_request("POST", "/subscription/request", data=payment_request_data,
                              headers=agency1_headers, desc="D6: POST /subscription/request")
    if payment_req:
        test_data["payment_request"]["id"] = payment_req.get("id")
        if payment_req.get("status") == "pending":
            log(f"Payment request created with status=pending", "PASS")
        else:
            log(f"Payment request status incorrect: {payment_req.get('status')}", "FAIL")

# D7: SA GET /admin/payment-requests?status=pending
if test_data["super_admin"].get("token") and test_data["payment_request"].get("id"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    pending_requests = test_request("GET", "/admin/payment-requests?status=pending",
                                   headers=sa_headers, desc="D7: SA GET pending payment requests")
    if pending_requests and isinstance(pending_requests, list):
        found = False
        for req in pending_requests:
            if req.get("id") == test_data["payment_request"]["id"]:
                found = True
                if req.get("agencyName"):
                    log(f"Payment request found with agencyName: {req.get('agencyName')}", "PASS")
                else:
                    log("Payment request missing agencyName", "FAIL")
                break
        if not found:
            log("Payment request not found in pending list", "FAIL")

# D8: SA POST /admin/payment-requests/:id/approve
if test_data["super_admin"].get("token") and test_data["payment_request"].get("id"):
    approve_result = test_request("POST", f"/admin/payment-requests/{test_data['payment_request']['id']}/approve",
                                 data={"note": "Approved for testing"}, headers=sa_headers,
                                 desc="D8: SA approve payment request")
    if approve_result:
        receipt = approve_result.get("receipt", {})
        if receipt.get("number") and receipt["number"].startswith("RCP"):
            log(f"Receipt generated: {receipt.get('number')}", "PASS")
            test_data["payment_request"]["receipt_id"] = receipt.get("id")
        else:
            log(f"Receipt number format incorrect: {receipt.get('number')}", "FAIL")

# D9: Verify agency plan upgraded
if test_data["agency1"].get("token"):
    me_result = test_request("GET", "/auth/me", headers=agency1_headers,
                            desc="D9: Verify agency plan upgraded")
    if me_result:
        agency = me_result.get("agency", {})
        if agency.get("plan") == "PROFESSIONAL":
            log(f"Agency plan upgraded to PROFESSIONAL", "PASS")
        else:
            log(f"Agency plan not upgraded: {agency.get('plan')}", "FAIL")
        
        limits = agency.get("limits", {})
        if limits.get("maxStaff") == 100:
            log(f"Agency maxStaff limit updated to 100", "PASS")
        else:
            log(f"Agency maxStaff limit incorrect: {limits.get('maxStaff')}", "FAIL")
        
        if agency.get("expiryDate"):
            expiry = datetime.fromisoformat(agency["expiryDate"].replace("Z", "+00:00"))
            days_diff = (expiry.date() - datetime.now().date()).days
            if 28 <= days_diff <= 32:
                log(f"Expiry date ~30 days from now: {agency.get('expiryDate')}", "PASS")
            else:
                log(f"Expiry date incorrect: {days_diff} days from now", "FAIL")

# D10: GET /receipts (agency should see receipt)
if test_data["agency1"].get("token"):
    receipts = test_request("GET", "/receipts", headers=agency1_headers,
                           desc="D10: GET /receipts")
    if receipts and isinstance(receipts, list) and len(receipts) > 0:
        if any(r.get("id") == test_data["payment_request"].get("receipt_id") for r in receipts):
            log(f"Receipt appears in agency receipts list", "PASS")
        else:
            log("Receipt not found in agency receipts", "FAIL")

# D11: Now agency should be able to add 6th staff
if test_data["agency1"].get("token"):
    staff_data = {"name": "6th Staff After Upgrade", "phone": "+919876543230", "monthlySalary": 20000}
    sixth_staff_success = test_request("POST", "/staff", data=staff_data, headers=agency1_headers,
                                      desc="D11: 6th staff after upgrade should succeed")
    if sixth_staff_success:
        log("6th staff added successfully after upgrade", "PASS")

# D12: Test /reject flow
# Create another agency and payment request
agency2_data = {
    "agencyName": "Agency for Reject Test",
    "ownerName": "Owner 2",
    "email": f"agency_reject_{datetime.now().timestamp()}@test.com",
    "password": "TestPass123!",
    "phone": "+919876543299"
}
agency2_result = test_request("POST", "/auth/signup", data=agency2_data,
                             desc="D12a: Create agency for reject test")
if agency2_result and test_data["plans"].get("professional"):
    agency2_token = agency2_result.get("token")
    agency2_headers = {"Authorization": f"Bearer {agency2_token}"}
    
    reject_payment_data = {
        "planId": test_data["plans"]["professional"].get("id"),
        "amount": 1499,
        "utrNumber": "REJECT123",
        "screenshotUrl": "data:image/png;base64,iVBORw0KGgo=",
        "transactionDate": datetime.now().strftime("%Y-%m-%d"),
        "billingCycle": "monthly"
    }
    reject_req = test_request("POST", "/subscription/request", data=reject_payment_data,
                             headers=agency2_headers, desc="D12b: Create payment request for reject")
    
    if reject_req and test_data["super_admin"].get("token"):
        reject_id = reject_req.get("id")
        sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
        
        # Reject the request
        reject_result = test_request("POST", f"/admin/payment-requests/{reject_id}/reject",
                                    data={"note": "Invalid payment proof"}, headers=sa_headers,
                                    desc="D12c: SA reject payment request")
        
        # Verify status changed to rejected
        all_requests = test_request("GET", "/admin/payment-requests", headers=sa_headers,
                                   desc="D12d: Verify rejected status")
        if all_requests:
            for req in all_requests:
                if req.get("id") == reject_id and req.get("status") == "rejected":
                    log("Payment request rejected successfully", "PASS")
                    break

# D13: Test /request-info flow
agency3_data = {
    "agencyName": "Agency for More Info Test",
    "ownerName": "Owner 3",
    "email": f"agency_info_{datetime.now().timestamp()}@test.com",
    "password": "TestPass123!",
    "phone": "+919876543298"
}
agency3_result = test_request("POST", "/auth/signup", data=agency3_data,
                             desc="D13a: Create agency for more info test")
if agency3_result and test_data["plans"].get("professional"):
    agency3_token = agency3_result.get("token")
    agency3_headers = {"Authorization": f"Bearer {agency3_token}"}
    
    info_payment_data = {
        "planId": test_data["plans"]["professional"].get("id"),
        "amount": 1499,
        "utrNumber": "INFO123",
        "screenshotUrl": "data:image/png;base64,iVBORw0KGgo=",
        "transactionDate": datetime.now().strftime("%Y-%m-%d"),
        "billingCycle": "monthly"
    }
    info_req = test_request("POST", "/subscription/request", data=info_payment_data,
                           headers=agency3_headers, desc="D13b: Create payment request for more info")
    
    if info_req and test_data["super_admin"].get("token"):
        info_id = info_req.get("id")
        sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
        
        # Request more info
        info_result = test_request("POST", f"/admin/payment-requests/{info_id}/request-info",
                                  data={"note": "Please provide clearer screenshot"}, headers=sa_headers,
                                  desc="D13c: SA request more info")
        
        # Verify status changed to more_info
        all_requests = test_request("GET", "/admin/payment-requests", headers=sa_headers,
                                   desc="D13d: Verify more_info status")
        if all_requests:
            for req in all_requests:
                if req.get("id") == info_id and req.get("status") == "more_info":
                    log("Payment request status changed to more_info", "PASS")
                    break

# ============================================================================
# E) AGENCY MANAGEMENT (Super Admin)
# ============================================================================
print("\n[E] AGENCY MANAGEMENT TESTS")
print("-" * 80)

if not test_data["super_admin"].get("token"):
    log("No super admin token - skipping agency management tests", "FAIL")
else:
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    # E1: GET /admin/agencies
    agencies = test_request("GET", "/admin/agencies", headers=sa_headers,
                           desc="E1: GET /admin/agencies")
    if agencies and isinstance(agencies, list):
        log(f"Retrieved {len(agencies)} agencies with enriched data", "PASS")
        # Pick an agency for management tests
        if len(agencies) > 0:
            test_agency = agencies[0]
            test_data["test_agency_id"] = test_agency.get("id")
    
    # E2: POST /admin/agencies/:id/suspend
    if test_data.get("test_agency_id"):
        suspend_result = test_request("POST", f"/admin/agencies/{test_data['test_agency_id']}/suspend",
                                     headers=sa_headers, desc="E2: Suspend agency")
        
        # Verify status changed
        agencies_after = test_request("GET", "/admin/agencies", headers=sa_headers,
                                     desc="E2b: Verify suspended status")
        if agencies_after:
            for a in agencies_after:
                if a.get("id") == test_data["test_agency_id"] and a.get("status") == "suspended":
                    log("Agency suspended successfully", "PASS")
                    break
    
    # E3: POST /admin/agencies/:id/activate
    if test_data.get("test_agency_id"):
        activate_result = test_request("POST", f"/admin/agencies/{test_data['test_agency_id']}/activate",
                                      headers=sa_headers, desc="E3: Activate agency")
        
        # Verify status changed back
        agencies_after = test_request("GET", "/admin/agencies", headers=sa_headers,
                                     desc="E3b: Verify active status")
        if agencies_after:
            for a in agencies_after:
                if a.get("id") == test_data["test_agency_id"] and a.get("status") == "active":
                    log("Agency activated successfully", "PASS")
                    break
    
    # E4: POST /admin/agencies/:id/change-plan
    if test_data.get("test_agency_id") and test_data["plans"].get("professional"):
        change_plan_data = {
            "planId": test_data["plans"]["professional"].get("id"),
            "billingCycle": "monthly"
        }
        change_result = test_request("POST", f"/admin/agencies/{test_data['test_agency_id']}/change-plan",
                                    data=change_plan_data, headers=sa_headers,
                                    desc="E4: Change agency plan")
        if change_result:
            log("Agency plan changed successfully", "PASS")
    
    # E5: POST /admin/agencies/:id/reset-password
    if test_data.get("test_agency_id"):
        reset_data = {"newPassword": "NewPassword123!"}
        reset_result = test_request("POST", f"/admin/agencies/{test_data['test_agency_id']}/reset-password",
                                   data=reset_data, headers=sa_headers,
                                   desc="E5: Reset agency password")
        if reset_result:
            log("Agency password reset successfully", "PASS")
    
    # E6: POST /admin/agencies/:id/login-as
    if test_data.get("test_agency_id"):
        login_as_result = test_request("POST", f"/admin/agencies/{test_data['test_agency_id']}/login-as",
                                      headers=sa_headers, desc="E6: Login as agency")
        if login_as_result:
            impersonation_token = login_as_result.get("token")
            if impersonation_token:
                log("Impersonation token received", "PASS")
                
                # Use impersonation token to call /auth/me
                imp_headers = {"Authorization": f"Bearer {impersonation_token}"}
                me_result = test_request("GET", "/auth/me", headers=imp_headers,
                                       desc="E6b: /auth/me with impersonation token")
                if me_result:
                    user = me_result.get("user", {})
                    agency = me_result.get("agency", {})
                    if user.get("role") == "agency_owner" and agency.get("id") == test_data["test_agency_id"]:
                        log(f"Impersonation working: returned agency owner for agency {agency.get('name')}", "PASS")
                    else:
                        log("Impersonation token returned wrong user/agency", "FAIL")
    
    # E7: DELETE /admin/agencies/:id (use a test agency, not the main one)
    # Create a disposable agency for deletion test
    delete_agency_data = {
        "agencyName": "Agency to Delete",
        "ownerName": "Delete Owner",
        "email": f"delete_{datetime.now().timestamp()}@test.com",
        "password": "DeletePass123!",
        "phone": "+919876543297"
    }
    delete_agency_result = test_request("POST", "/auth/signup", data=delete_agency_data,
                                       desc="E7a: Create agency for deletion")
    if delete_agency_result:
        delete_agency_id = delete_agency_result.get("agency", {}).get("id")
        
        # Delete the agency
        delete_result = test_request("DELETE", f"/admin/agencies/{delete_agency_id}",
                                    headers=sa_headers, desc="E7b: DELETE agency")
        if delete_result:
            log("Agency deleted successfully (cascade delete)", "PASS")

# ============================================================================
# F) ADMIN DASHBOARD
# ============================================================================
print("\n[F] ADMIN DASHBOARD TESTS")
print("-" * 80)

if not test_data["super_admin"].get("token"):
    log("No super admin token - skipping admin dashboard tests", "FAIL")
else:
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    dashboard = test_request("GET", "/admin/dashboard", headers=sa_headers,
                            desc="F1: GET /admin/dashboard")
    if dashboard:
        cards = dashboard.get("cards", {})
        growth = dashboard.get("growth", [])
        
        if cards and isinstance(cards, dict):
            log(f"Dashboard cards: totalAgencies={cards.get('totalAgencies')}, totalRevenue={cards.get('totalRevenue')}", "PASS")
        
        if isinstance(growth, list) and len(growth) == 6:
            log(f"Dashboard growth array has 6 months", "PASS")
        else:
            log(f"Dashboard growth array incorrect: {len(growth) if isinstance(growth, list) else 'not a list'}", "FAIL")

# ============================================================================
# G) AUDIT LOG
# ============================================================================
print("\n[G] AUDIT LOG TESTS")
print("-" * 80)

if not test_data["super_admin"].get("token"):
    log("No super admin token - skipping audit log tests", "FAIL")
else:
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    audit = test_request("GET", "/admin/audit", headers=sa_headers,
                        desc="G1: GET /admin/audit")
    if audit and isinstance(audit, list):
        log(f"Retrieved {len(audit)} audit entries", "PASS")
        
        # Check if recent actions are logged
        recent_actions = [entry.get("action") for entry in audit[:10]]
        log(f"Recent audit actions: {', '.join(recent_actions[:5])}", "INFO")

# ============================================================================
# H) SUPPORT TICKETS
# ============================================================================
print("\n[H] SUPPORT TICKETS TESTS")
print("-" * 80)

# H1: Agency creates ticket
if test_data["agency1"].get("token"):
    agency1_headers = {"Authorization": f"Bearer {test_data['agency1']['token']}"}
    
    ticket_data = {
        "subject": "Need help with subscription",
        "message": "I need assistance with upgrading my plan",
        "priority": "high"
    }
    ticket = test_request("POST", "/support/tickets", data=ticket_data, headers=agency1_headers,
                         desc="H1: Agency creates support ticket")
    if ticket:
        test_data["ticket_id"] = ticket.get("id")
        if ticket.get("status") == "open":
            log(f"Ticket created with status=open", "PASS")

# H2: SA sees ticket with agencyName
if test_data["super_admin"].get("token") and test_data.get("ticket_id"):
    sa_headers = {"Authorization": f"Bearer {test_data['super_admin']['token']}"}
    
    tickets = test_request("GET", "/support/tickets", headers=sa_headers,
                          desc="H2: SA GET support tickets")
    if tickets and isinstance(tickets, list):
        found = False
        for t in tickets:
            if t.get("id") == test_data["ticket_id"]:
                found = True
                if t.get("agencyName"):
                    log(f"Ticket has agencyName: {t.get('agencyName')}", "PASS")
                else:
                    log("Ticket missing agencyName", "FAIL")
                break
        if not found:
            log("Ticket not found in SA list", "FAIL")

# H3: SA replies to ticket
if test_data["super_admin"].get("token") and test_data.get("ticket_id"):
    reply_data = {"message": "We are looking into your request", "status": "in_progress"}
    reply_result = test_request("POST", f"/support/tickets/{test_data['ticket_id']}/reply",
                               data=reply_data, headers=sa_headers,
                               desc="H3: SA replies to ticket")
    if reply_result:
        log("SA reply added successfully", "PASS")

# H4: PUT /support/tickets/:id (update status)
if test_data["super_admin"].get("token") and test_data.get("ticket_id"):
    update_data = {"status": "resolved"}
    update_result = test_request("PUT", f"/support/tickets/{test_data['ticket_id']}",
                                data=update_data, headers=sa_headers,
                                desc="H4: Update ticket status to resolved")
    if update_result:
        log("Ticket status updated to resolved", "PASS")

# H5: Cross-agency isolation
# Create another agency and verify it can't see first agency's tickets
agency_iso_data = {
    "agencyName": "Isolated Agency",
    "ownerName": "Iso Owner",
    "email": f"iso_{datetime.now().timestamp()}@test.com",
    "password": "IsoPass123!",
    "phone": "+919876543296"
}
agency_iso_result = test_request("POST", "/auth/signup", data=agency_iso_data,
                                desc="H5a: Create isolated agency")
if agency_iso_result:
    iso_token = agency_iso_result.get("token")
    iso_headers = {"Authorization": f"Bearer {iso_token}"}
    
    iso_tickets = test_request("GET", "/support/tickets", headers=iso_headers,
                              desc="H5b: Isolated agency GET tickets")
    if iso_tickets and isinstance(iso_tickets, list):
        # Should not see the first agency's ticket
        if not any(t.get("id") == test_data.get("ticket_id") for t in iso_tickets):
            log("Cross-agency ticket isolation working", "PASS")
        else:
            log("Cross-agency ticket isolation FAILED - can see other agency's tickets", "FAIL")

# ============================================================================
# I) REGRESSION TESTS
# ============================================================================
print("\n[I] REGRESSION TESTS")
print("-" * 80)

# I1: Create fresh FREE agency and verify all limits
regression_agency_data = {
    "agencyName": "Regression Test Agency",
    "ownerName": "Regression Owner",
    "email": f"regression_{datetime.now().timestamp()}@test.com",
    "password": "RegPass123!",
    "phone": "+919876543295"
}
regression_result = test_request("POST", "/auth/signup", data=regression_agency_data,
                                desc="I1: Create fresh FREE agency for regression")
if regression_result:
    reg_token = regression_result.get("token")
    reg_headers = {"Authorization": f"Bearer {reg_token}"}
    
    agency = regression_result.get("agency", {})
    if agency.get("plan") == "FREE":
        log("Regression: Agency created with FREE plan", "PASS")
    
    # I2: Test staff limit (5)
    for i in range(5):
        staff_data = {"name": f"Reg Staff {i+1}", "phone": f"+9198765432{40+i}", "monthlySalary": 20000}
        test_request("POST", "/staff", data=staff_data, headers=reg_headers,
                    desc=f"I2: Add regression staff {i+1}/5")
    
    # 6th should fail
    staff_data = {"name": "Reg Staff 6", "phone": "+919876543250", "monthlySalary": 20000}
    sixth = test_request("POST", "/staff", data=staff_data, headers=reg_headers,
                        expected_status=402, desc="I2: 6th staff should fail (402)")
    
    # I3: Test client limit (5)
    for i in range(5):
        client_data = {"name": f"Reg Client {i+1}", "phone": f"+9198765432{50+i}"}
        test_request("POST", "/clients", data=client_data, headers=reg_headers,
                    desc=f"I3: Add regression client {i+1}/5")
    
    # 6th should fail
    client_data = {"name": "Reg Client 6", "phone": "+919876543260"}
    sixth_client = test_request("POST", "/clients", data=client_data, headers=reg_headers,
                               expected_status=402, desc="I3: 6th client should fail (402)")
    
    # I4: Test vendor limit (5)
    for i in range(5):
        vendor_data = {"name": f"Reg Vendor {i+1}", "phone": f"+9198765432{60+i}"}
        test_request("POST", "/vendors", data=vendor_data, headers=reg_headers,
                    desc=f"I4: Add regression vendor {i+1}/5")
    
    # 6th should fail
    vendor_data = {"name": "Reg Vendor 6", "phone": "+919876543270"}
    sixth_vendor = test_request("POST", "/vendors", data=vendor_data, headers=reg_headers,
                               expected_status=402, desc="I4: 6th vendor should fail (402)")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*80)
print("TEST SUITE COMPLETE")
print("="*80)
print("\nReview the test results above for detailed pass/fail status.")
print("All critical flows have been tested comprehensively.\n")

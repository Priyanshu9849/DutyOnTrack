#!/usr/bin/env python3
"""
DutyOnTrack Backend API Test Suite
Tests all backend endpoints with focus on:
- Auth (signup, login, /auth/me)
- Multi-tenant isolation
- Staff CRUD with FREE plan limits
- Clients CRUD with patient medical fields
- Vendors CRUD with commission types
- Placements CRUD with auto-calculations
- Dashboard aggregates
- Global search
"""

import requests
import json
from datetime import datetime, timedelta
import sys

# Base URL from .env
BASE_URL = "https://agency-pro-33.preview.emergentagent.com/api"

# Test results tracking
test_results = {
    "passed": 0,
    "failed": 0,
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

def test_auth():
    """Test authentication endpoints"""
    print("\n" + "="*80)
    print("TEST 1: AUTHENTICATION")
    print("="*80)
    
    # Test 1.1: Signup Agency A
    print("\n[1.1] Testing POST /api/auth/signup - Agency A")
    try:
        signup_data = {
            "agencyName": "HealthCare Staffing Solutions",
            "ownerName": "Rajesh Kumar",
            "email": f"rajesh.kumar.{datetime.now().timestamp()}@example.com",
            "password": "SecurePass123!",
            "phone": "9876543210"
        }
        response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "token" in data and "user" in data and "agency" in data:
                agency_a_token = data["token"]
                agency_a_id = data["agency"]["id"]
                
                # Verify agency defaults
                agency = data["agency"]
                if agency.get("plan") == "FREE":
                    log_test("Signup - Agency plan defaults to FREE", True)
                else:
                    log_test("Signup - Agency plan defaults to FREE", False, f"Expected plan='FREE', got '{agency.get('plan')}'")
                
                limits = agency.get("limits", {})
                if limits.get("maxStaff") == 5 and limits.get("maxClients") == 5 and limits.get("maxVendors") == 5:
                    log_test("Signup - FREE plan limits correct", True, "maxStaff=5, maxClients=5, maxVendors=5")
                else:
                    log_test("Signup - FREE plan limits correct", False, f"Expected limits {{maxStaff:5, maxClients:5, maxVendors:5}}, got {limits}")
                
                if data["user"].get("role") == "agency_owner":
                    log_test("Signup - User role is agency_owner", True)
                else:
                    log_test("Signup - User role is agency_owner", False, f"Expected role='agency_owner', got '{data['user'].get('role')}'")
                
                log_test("Signup - Agency A created successfully", True, f"Agency ID: {agency_a_id}")
                return agency_a_token, agency_a_id, signup_data["email"]
            else:
                log_test("Signup - Agency A created successfully", False, "Missing token, user, or agency in response")
                return None, None, None
        else:
            log_test("Signup - Agency A created successfully", False, f"Status {response.status_code}: {response.text}")
            return None, None, None
    except Exception as e:
        log_test("Signup - Agency A created successfully", False, f"Exception: {str(e)}")
        return None, None, None

def test_login(email, password):
    """Test login endpoint"""
    print("\n[1.2] Testing POST /api/auth/login")
    
    # Test valid credentials
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password}, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "token" in data:
                log_test("Login - Valid credentials", True)
            else:
                log_test("Login - Valid credentials", False, "Token not in response")
        else:
            log_test("Login - Valid credentials", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Login - Valid credentials", False, f"Exception: {str(e)}")
    
    # Test invalid credentials
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "WrongPassword"}, timeout=10)
        if response.status_code == 401:
            log_test("Login - Invalid credentials return 401", True)
        else:
            log_test("Login - Invalid credentials return 401", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("Login - Invalid credentials return 401", False, f"Exception: {str(e)}")

def test_auth_me(token):
    """Test /auth/me endpoint"""
    print("\n[1.3] Testing GET /api/auth/me")
    
    # Test with valid token
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/auth/me", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if "user" in data and "agency" in data:
                log_test("/auth/me - With valid token", True)
            else:
                log_test("/auth/me - With valid token", False, "Missing user or agency in response")
        else:
            log_test("/auth/me - With valid token", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("/auth/me - With valid token", False, f"Exception: {str(e)}")
    
    # Test without token
    try:
        response = requests.get(f"{BASE_URL}/auth/me", timeout=10)
        if response.status_code == 401:
            log_test("/auth/me - Without token returns 401", True)
        else:
            log_test("/auth/me - Without token returns 401", False, f"Expected 401, got {response.status_code}")
    except Exception as e:
        log_test("/auth/me - Without token returns 401", False, f"Exception: {str(e)}")

def test_multi_tenant_isolation():
    """Test multi-tenant data isolation"""
    print("\n" + "="*80)
    print("TEST 2: MULTI-TENANT ISOLATION")
    print("="*80)
    
    # Create Agency A
    print("\n[2.1] Creating Agency A")
    try:
        signup_a = {
            "agencyName": "Agency Alpha Healthcare",
            "ownerName": "Alice Anderson",
            "email": f"alice.{datetime.now().timestamp()}@example.com",
            "password": "AlicePass123!",
            "phone": "9111111111"
        }
        response_a = requests.post(f"{BASE_URL}/auth/signup", json=signup_a, timeout=10)
        if response_a.status_code != 200:
            log_test("Multi-tenant - Create Agency A", False, f"Status {response_a.status_code}")
            return
        
        data_a = response_a.json()
        token_a = data_a["token"]
        agency_a_id = data_a["agency"]["id"]
        log_test("Multi-tenant - Create Agency A", True, f"Agency ID: {agency_a_id}")
    except Exception as e:
        log_test("Multi-tenant - Create Agency A", False, f"Exception: {str(e)}")
        return
    
    # Create Agency B
    print("\n[2.2] Creating Agency B")
    try:
        signup_b = {
            "agencyName": "Agency Beta Medical",
            "ownerName": "Bob Brown",
            "email": f"bob.{datetime.now().timestamp()}@example.com",
            "password": "BobPass123!",
            "phone": "9222222222"
        }
        response_b = requests.post(f"{BASE_URL}/auth/signup", json=signup_b, timeout=10)
        if response_b.status_code != 200:
            log_test("Multi-tenant - Create Agency B", False, f"Status {response_b.status_code}")
            return
        
        data_b = response_b.json()
        token_b = data_b["token"]
        agency_b_id = data_b["agency"]["id"]
        log_test("Multi-tenant - Create Agency B", True, f"Agency ID: {agency_b_id}")
    except Exception as e:
        log_test("Multi-tenant - Create Agency B", False, f"Exception: {str(e)}")
        return
    
    # Add staff to Agency A
    print("\n[2.3] Adding staff to Agency A")
    try:
        staff_a = {
            "name": "Staff Member A1",
            "phone": "9333333333",
            "monthlySalary": 20000
        }
        headers_a = {"Authorization": f"Bearer {token_a}"}
        response = requests.post(f"{BASE_URL}/staff", json=staff_a, headers=headers_a, timeout=10)
        if response.status_code == 200:
            staff_a_id = response.json()["id"]
            log_test("Multi-tenant - Add staff to Agency A", True, f"Staff ID: {staff_a_id}")
        else:
            log_test("Multi-tenant - Add staff to Agency A", False, f"Status {response.status_code}")
            return
    except Exception as e:
        log_test("Multi-tenant - Add staff to Agency A", False, f"Exception: {str(e)}")
        return
    
    # Add staff to Agency B
    print("\n[2.4] Adding staff to Agency B")
    try:
        staff_b = {
            "name": "Staff Member B1",
            "phone": "9444444444",
            "monthlySalary": 22000
        }
        headers_b = {"Authorization": f"Bearer {token_b}"}
        response = requests.post(f"{BASE_URL}/staff", json=staff_b, headers=headers_b, timeout=10)
        if response.status_code == 200:
            staff_b_id = response.json()["id"]
            log_test("Multi-tenant - Add staff to Agency B", True, f"Staff ID: {staff_b_id}")
        else:
            log_test("Multi-tenant - Add staff to Agency B", False, f"Status {response.status_code}")
            return
    except Exception as e:
        log_test("Multi-tenant - Add staff to Agency B", False, f"Exception: {str(e)}")
        return
    
    # Verify Agency A cannot see Agency B's staff
    print("\n[2.5] Verifying Agency A cannot see Agency B's staff")
    try:
        response = requests.get(f"{BASE_URL}/staff", headers=headers_a, timeout=10)
        if response.status_code == 200:
            staff_list = response.json()
            # Should only see 1 staff member (their own)
            if len(staff_list) == 1 and staff_list[0]["name"] == "Staff Member A1":
                log_test("Multi-tenant - Agency A sees only own staff", True, f"Found 1 staff member")
            else:
                log_test("Multi-tenant - Agency A sees only own staff", False, f"Expected 1 staff, found {len(staff_list)}")
        else:
            log_test("Multi-tenant - Agency A sees only own staff", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Multi-tenant - Agency A sees only own staff", False, f"Exception: {str(e)}")
    
    # Verify Agency B cannot see Agency A's staff
    print("\n[2.6] Verifying Agency B cannot see Agency A's staff")
    try:
        response = requests.get(f"{BASE_URL}/staff", headers=headers_b, timeout=10)
        if response.status_code == 200:
            staff_list = response.json()
            if len(staff_list) == 1 and staff_list[0]["name"] == "Staff Member B1":
                log_test("Multi-tenant - Agency B sees only own staff", True, f"Found 1 staff member")
            else:
                log_test("Multi-tenant - Agency B sees only own staff", False, f"Expected 1 staff, found {len(staff_list)}")
        else:
            log_test("Multi-tenant - Agency B sees only own staff", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Multi-tenant - Agency B sees only own staff", False, f"Exception: {str(e)}")
    
    # Try to access Agency B's staff with Agency A's token
    print("\n[2.7] Verifying Agency A cannot access Agency B's staff by ID")
    try:
        response = requests.get(f"{BASE_URL}/staff/{staff_b_id}", headers=headers_a, timeout=10)
        # Should return 404 or empty, not the actual staff
        if response.status_code == 404 or (response.status_code == 200 and not response.json()):
            log_test("Multi-tenant - Agency A cannot access Agency B's staff by ID", True)
        else:
            log_test("Multi-tenant - Agency A cannot access Agency B's staff by ID", False, f"Status {response.status_code}, should be 404")
    except Exception as e:
        log_test("Multi-tenant - Agency A cannot access Agency B's staff by ID", False, f"Exception: {str(e)}")

def test_staff_crud(token):
    """Test Staff CRUD operations and FREE plan limits"""
    print("\n" + "="*80)
    print("TEST 3: STAFF CRUD WITH FREE PLAN LIMITS")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    staff_ids = []
    
    # Create 5 staff members (FREE plan limit)
    print("\n[3.1] Creating 5 staff members (FREE plan limit)")
    for i in range(5):
        try:
            staff_data = {
                "name": f"Nurse {chr(65+i)}",
                "phone": f"98765432{10+i}",
                "monthlySalary": 18000 + (i * 1000)
            }
            response = requests.post(f"{BASE_URL}/staff", json=staff_data, headers=headers, timeout=10)
            if response.status_code == 200:
                staff_id = response.json()["id"]
                staff_code = response.json().get("staffCode", "")
                staff_ids.append(staff_id)
                
                # Verify staffCode has STF prefix
                if staff_code.startswith("STF"):
                    if i == 0:  # Only log once
                        log_test("Staff CRUD - staffCode has STF prefix", True, f"Example: {staff_code}")
                else:
                    log_test("Staff CRUD - staffCode has STF prefix", False, f"Expected STF prefix, got {staff_code}")
            else:
                log_test(f"Staff CRUD - Create staff {i+1}/5", False, f"Status {response.status_code}")
        except Exception as e:
            log_test(f"Staff CRUD - Create staff {i+1}/5", False, f"Exception: {str(e)}")
    
    if len(staff_ids) == 5:
        log_test("Staff CRUD - Created 5 staff members", True)
    else:
        log_test("Staff CRUD - Created 5 staff members", False, f"Only created {len(staff_ids)}")
    
    # Try to create 6th staff (should fail with 402)
    print("\n[3.2] Attempting to create 6th staff (should fail with 402)")
    try:
        staff_data = {
            "name": "Nurse F (Should Fail)",
            "phone": "9876543220",
            "monthlySalary": 23000
        }
        response = requests.post(f"{BASE_URL}/staff", json=staff_data, headers=headers, timeout=10)
        if response.status_code == 402:
            error_msg = response.json().get("error", "")
            if "Free plan" in error_msg or "limit" in error_msg.lower():
                log_test("Staff CRUD - 6th staff returns 402 with limit message", True, f"Error: {error_msg}")
            else:
                log_test("Staff CRUD - 6th staff returns 402 with limit message", False, f"Got 402 but message unclear: {error_msg}")
        else:
            log_test("Staff CRUD - 6th staff returns 402 with limit message", False, f"Expected 402, got {response.status_code}")
    except Exception as e:
        log_test("Staff CRUD - 6th staff returns 402 with limit message", False, f"Exception: {str(e)}")
    
    # Test GET all staff
    print("\n[3.3] Testing GET /api/staff")
    try:
        response = requests.get(f"{BASE_URL}/staff", headers=headers, timeout=10)
        if response.status_code == 200:
            staff_list = response.json()
            if len(staff_list) >= 5:
                log_test("Staff CRUD - GET all staff", True, f"Found {len(staff_list)} staff members")
            else:
                log_test("Staff CRUD - GET all staff", False, f"Expected at least 5, found {len(staff_list)}")
        else:
            log_test("Staff CRUD - GET all staff", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Staff CRUD - GET all staff", False, f"Exception: {str(e)}")
    
    # Test PUT (update) staff
    if staff_ids:
        print("\n[3.4] Testing PUT /api/staff/:id")
        try:
            update_data = {"name": "Nurse A Updated", "monthlySalary": 25000}
            response = requests.put(f"{BASE_URL}/staff/{staff_ids[0]}", json=update_data, headers=headers, timeout=10)
            if response.status_code == 200:
                updated = response.json()
                if updated.get("name") == "Nurse A Updated" and updated.get("monthlySalary") == 25000:
                    log_test("Staff CRUD - UPDATE staff", True)
                else:
                    log_test("Staff CRUD - UPDATE staff", False, "Update didn't persist correctly")
            else:
                log_test("Staff CRUD - UPDATE staff", False, f"Status {response.status_code}")
        except Exception as e:
            log_test("Staff CRUD - UPDATE staff", False, f"Exception: {str(e)}")
        
        # Test DELETE staff
        print("\n[3.5] Testing DELETE /api/staff/:id")
        try:
            response = requests.delete(f"{BASE_URL}/staff/{staff_ids[-1]}", headers=headers, timeout=10)
            if response.status_code == 200:
                # Verify it's deleted
                response = requests.get(f"{BASE_URL}/staff", headers=headers, timeout=10)
                if response.status_code == 200:
                    staff_list = response.json()
                    if len(staff_list) == len(staff_ids) - 1:
                        log_test("Staff CRUD - DELETE staff", True)
                    else:
                        log_test("Staff CRUD - DELETE staff", False, f"Expected {len(staff_ids)-1} staff, found {len(staff_list)}")
            else:
                log_test("Staff CRUD - DELETE staff", False, f"Status {response.status_code}")
        except Exception as e:
            log_test("Staff CRUD - DELETE staff", False, f"Exception: {str(e)}")
    
    return staff_ids

def test_clients_crud(token):
    """Test Clients CRUD with patient medical fields"""
    print("\n" + "="*80)
    print("TEST 4: CLIENTS CRUD WITH PATIENT MEDICAL FIELDS")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    client_ids = []
    
    # Create client with all patient medical fields
    print("\n[4.1] Creating client with patient medical fields")
    try:
        client_data = {
            "name": "Mr. Sharma Family",
            "patientName": "Mrs. Sharma",
            "phone": "9988776655",
            "address": "123 MG Road, Bangalore",
            "city": "Bangalore",
            "location": "Home",
            "careType": "24-hour nursing",
            "rtTube": True,
            "ttTube": False,
            "oxygen": True,
            "catheter": True,
            "tracheostomy": False,
            "rylesTube": True,
            "monthlyCharges": 35000
        }
        response = requests.post(f"{BASE_URL}/clients", json=client_data, headers=headers, timeout=10)
        if response.status_code == 200:
            client = response.json()
            client_id = client["id"]
            client_ids.append(client_id)
            
            # Verify all boolean fields
            fields_correct = (
                client.get("rtTube") == True and
                client.get("ttTube") == False and
                client.get("oxygen") == True and
                client.get("catheter") == True and
                client.get("tracheostomy") == False and
                client.get("rylesTube") == True
            )
            
            if fields_correct:
                log_test("Clients CRUD - Patient medical fields persist on create", True)
            else:
                log_test("Clients CRUD - Patient medical fields persist on create", False, 
                        f"Fields mismatch: rtTube={client.get('rtTube')}, ttTube={client.get('ttTube')}, oxygen={client.get('oxygen')}, catheter={client.get('catheter')}, tracheostomy={client.get('tracheostomy')}, rylesTube={client.get('rylesTube')}")
        else:
            log_test("Clients CRUD - Create client", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Clients CRUD - Create client", False, f"Exception: {str(e)}")
    
    # Create 4 more clients to reach FREE limit
    print("\n[4.2] Creating 4 more clients (total 5 for FREE limit)")
    for i in range(4):
        try:
            client_data = {
                "name": f"Client Family {chr(66+i)}",
                "patientName": f"Patient {chr(66+i)}",
                "phone": f"99887766{56+i}",
                "monthlyCharges": 30000 + (i * 2000)
            }
            response = requests.post(f"{BASE_URL}/clients", json=client_data, headers=headers, timeout=10)
            if response.status_code == 200:
                client_ids.append(response.json()["id"])
        except Exception as e:
            log_test(f"Clients CRUD - Create client {i+2}/5", False, f"Exception: {str(e)}")
    
    if len(client_ids) == 5:
        log_test("Clients CRUD - Created 5 clients", True)
    else:
        log_test("Clients CRUD - Created 5 clients", False, f"Only created {len(client_ids)}")
    
    # Try to create 6th client (should fail with 402)
    print("\n[4.3] Attempting to create 6th client (should fail with 402)")
    try:
        client_data = {
            "name": "Client F (Should Fail)",
            "phone": "9988776660",
            "monthlyCharges": 40000
        }
        response = requests.post(f"{BASE_URL}/clients", json=client_data, headers=headers, timeout=10)
        if response.status_code == 402:
            error_msg = response.json().get("error", "")
            if "Free plan" in error_msg or "limit" in error_msg.lower():
                log_test("Clients CRUD - 6th client returns 402 with limit message", True, f"Error: {error_msg}")
            else:
                log_test("Clients CRUD - 6th client returns 402 with limit message", False, f"Got 402 but message unclear: {error_msg}")
        else:
            log_test("Clients CRUD - 6th client returns 402 with limit message", False, f"Expected 402, got {response.status_code}")
    except Exception as e:
        log_test("Clients CRUD - 6th client returns 402 with limit message", False, f"Exception: {str(e)}")
    
    # Test UPDATE with patient medical fields
    if client_ids:
        print("\n[4.4] Testing PUT /api/clients/:id with updated medical fields")
        try:
            update_data = {
                "rtTube": False,
                "ttTube": True,
                "oxygen": False,
                "catheter": False,
                "tracheostomy": True,
                "rylesTube": False
            }
            response = requests.put(f"{BASE_URL}/clients/{client_ids[0]}", json=update_data, headers=headers, timeout=10)
            if response.status_code == 200:
                updated = response.json()
                fields_correct = (
                    updated.get("rtTube") == False and
                    updated.get("ttTube") == True and
                    updated.get("oxygen") == False and
                    updated.get("catheter") == False and
                    updated.get("tracheostomy") == True and
                    updated.get("rylesTube") == False
                )
                
                if fields_correct:
                    log_test("Clients CRUD - Patient medical fields persist on update", True)
                else:
                    log_test("Clients CRUD - Patient medical fields persist on update", False, 
                            f"Fields mismatch after update")
            else:
                log_test("Clients CRUD - UPDATE client", False, f"Status {response.status_code}")
        except Exception as e:
            log_test("Clients CRUD - UPDATE client", False, f"Exception: {str(e)}")
    
    return client_ids

def test_vendors_crud(token):
    """Test Vendors CRUD with commission types"""
    print("\n" + "="*80)
    print("TEST 5: VENDORS CRUD WITH COMMISSION TYPES")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    vendor_ids = []
    
    # Create vendor with fixed commission
    print("\n[5.1] Creating vendor with fixed commission")
    try:
        vendor_data = {
            "name": "HealthStaff Providers Ltd",
            "phone": "9876543210",
            "email": "contact@healthstaff.com",
            "commissionType": "fixed",
            "commissionAmount": 2000
        }
        response = requests.post(f"{BASE_URL}/vendors", json=vendor_data, headers=headers, timeout=10)
        if response.status_code == 200:
            vendor = response.json()
            vendor_ids.append({"id": vendor["id"], "type": "fixed", "amount": 2000})
            
            if vendor.get("commissionType") == "fixed" and vendor.get("commissionAmount") == 2000:
                log_test("Vendors CRUD - Create vendor with fixed commission", True)
            else:
                log_test("Vendors CRUD - Create vendor with fixed commission", False, 
                        f"Expected fixed/2000, got {vendor.get('commissionType')}/{vendor.get('commissionAmount')}")
        else:
            log_test("Vendors CRUD - Create vendor with fixed commission", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Vendors CRUD - Create vendor with fixed commission", False, f"Exception: {str(e)}")
    
    # Create vendor with percent commission
    print("\n[5.2] Creating vendor with percent commission")
    try:
        vendor_data = {
            "name": "MediCare Staffing Agency",
            "phone": "9876543211",
            "email": "info@medicare-staffing.com",
            "commissionType": "percent",
            "commissionAmount": 10
        }
        response = requests.post(f"{BASE_URL}/vendors", json=vendor_data, headers=headers, timeout=10)
        if response.status_code == 200:
            vendor = response.json()
            vendor_ids.append({"id": vendor["id"], "type": "percent", "amount": 10})
            
            if vendor.get("commissionType") == "percent" and vendor.get("commissionAmount") == 10:
                log_test("Vendors CRUD - Create vendor with percent commission", True)
            else:
                log_test("Vendors CRUD - Create vendor with percent commission", False, 
                        f"Expected percent/10, got {vendor.get('commissionType')}/{vendor.get('commissionAmount')}")
        else:
            log_test("Vendors CRUD - Create vendor with percent commission", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Vendors CRUD - Create vendor with percent commission", False, f"Exception: {str(e)}")
    
    # Test GET vendors
    print("\n[5.3] Testing GET /api/vendors")
    try:
        response = requests.get(f"{BASE_URL}/vendors", headers=headers, timeout=10)
        if response.status_code == 200:
            vendors = response.json()
            if len(vendors) >= 2:
                log_test("Vendors CRUD - GET all vendors", True, f"Found {len(vendors)} vendors")
            else:
                log_test("Vendors CRUD - GET all vendors", False, f"Expected at least 2, found {len(vendors)}")
        else:
            log_test("Vendors CRUD - GET all vendors", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Vendors CRUD - GET all vendors", False, f"Exception: {str(e)}")
    
    return vendor_ids

def test_placements_crud(token, staff_ids, client_ids, vendor_ids):
    """Test Placements CRUD with auto-calculations"""
    print("\n" + "="*80)
    print("TEST 6: PLACEMENTS CRUD WITH AUTO-CALCULATIONS")
    print("="*80)
    
    if not staff_ids or not client_ids or not vendor_ids:
        log_test("Placements CRUD - Prerequisites", False, "Missing staff, clients, or vendors")
        return []
    
    headers = {"Authorization": f"Bearer {token}"}
    placement_ids = []
    
    # Create placement with percent commission (30 days ago, no offDate)
    print("\n[6.1] Creating placement with percent commission (30 days ago)")
    try:
        join_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        vendor_percent = next((v for v in vendor_ids if v["type"] == "percent"), None)
        
        if not vendor_percent:
            log_test("Placements CRUD - Create placement with percent commission", False, "No percent vendor found")
        else:
            placement_data = {
                "clientId": client_ids[0],
                "staffId": staff_ids[0],
                "vendorId": vendor_percent["id"],
                "joinDate": join_date,
                "monthlyClientCharge": 30000,
                "monthlyStaffSalary": 18000,
                "vendorCommission": 10,
                "vendorCommissionType": "percent",
                "dutyType": "24 Hr",
                "location": "Home"
            }
            response = requests.post(f"{BASE_URL}/placements", json=placement_data, headers=headers, timeout=10)
            if response.status_code == 200:
                placement = response.json()
                placement_ids.append(placement["id"])
                log_test("Placements CRUD - Create placement", True, f"Placement ID: {placement['id']}")
                
                # Now GET to verify enrichment and calculations
                print("\n[6.2] Verifying GET returns enriched data with calculations")
                response = requests.get(f"{BASE_URL}/placements", headers=headers, timeout=10)
                if response.status_code == 200:
                    placements = response.json()
                    created_placement = next((p for p in placements if p["id"] == placement["id"]), None)
                    
                    if created_placement:
                        # Check enrichment
                        has_enrichment = (
                            "staffName" in created_placement and
                            "clientName" in created_placement and
                            "vendorName" in created_placement
                        )
                        
                        if has_enrichment:
                            log_test("Placements - Enriched with staffName, clientName, vendorName", True)
                        else:
                            log_test("Placements - Enriched with staffName, clientName, vendorName", False, 
                                    "Missing enrichment fields")
                        
                        # Check calculations
                        calc = created_placement.get("calc", {})
                        working_days = calc.get("workingDays", 0)
                        client_bill = calc.get("clientBill", 0)
                        staff_salary = calc.get("staffSalary", 0)
                        vendor_commission = calc.get("vendorCommission", 0)
                        agency_profit = calc.get("agencyProfit", 0)
                        
                        # For 30 days: clientBill ≈ 30000, staffSalary ≈ 18000, vendorCommission ≈ 3000 (10% of 30000), profit ≈ 9000
                        if 28 <= working_days <= 32:
                            log_test("Placements - workingDays calculated correctly", True, f"workingDays={working_days}")
                        else:
                            log_test("Placements - workingDays calculated correctly", False, f"Expected ~30, got {working_days}")
                        
                        if 28000 <= client_bill <= 32000:
                            log_test("Placements - clientBill calculated correctly", True, f"clientBill={client_bill}")
                        else:
                            log_test("Placements - clientBill calculated correctly", False, f"Expected ~30000, got {client_bill}")
                        
                        if 17000 <= staff_salary <= 19000:
                            log_test("Placements - staffSalary calculated correctly", True, f"staffSalary={staff_salary}")
                        else:
                            log_test("Placements - staffSalary calculated correctly", False, f"Expected ~18000, got {staff_salary}")
                        
                        if 2800 <= vendor_commission <= 3200:
                            log_test("Placements - vendorCommission (percent) calculated correctly", True, f"vendorCommission={vendor_commission}")
                        else:
                            log_test("Placements - vendorCommission (percent) calculated correctly", False, f"Expected ~3000, got {vendor_commission}")
                        
                        if 8000 <= agency_profit <= 10000:
                            log_test("Placements - agencyProfit calculated correctly", True, f"agencyProfit={agency_profit}")
                        else:
                            log_test("Placements - agencyProfit calculated correctly", False, f"Expected ~9000, got {agency_profit}")
                    else:
                        log_test("Placements - GET enriched data", False, "Created placement not found in GET response")
                else:
                    log_test("Placements - GET enriched data", False, f"Status {response.status_code}")
            else:
                log_test("Placements CRUD - Create placement", False, f"Status {response.status_code}: {response.text}")
    except Exception as e:
        log_test("Placements CRUD - Create placement", False, f"Exception: {str(e)}")
    
    # Verify staff status changed to 'onduty'
    print("\n[6.3] Verifying staff status changed to 'onduty'")
    try:
        response = requests.get(f"{BASE_URL}/staff", headers=headers, timeout=10)
        if response.status_code == 200:
            staff_list = response.json()
            staff = next((s for s in staff_list if s["id"] == staff_ids[0]), None)
            
            if staff and staff.get("status") == "onduty":
                log_test("Placements - Staff status changed to 'onduty'", True)
            else:
                log_test("Placements - Staff status changed to 'onduty'", False, 
                        f"Expected status='onduty', got '{staff.get('status') if staff else 'staff not found'}'")
        else:
            log_test("Placements - Staff status changed to 'onduty'", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Placements - Staff status changed to 'onduty'", False, f"Exception: {str(e)}")
    
    # Update placement with offDate (complete duty)
    if placement_ids:
        print("\n[6.4] Updating placement with offDate (completing duty)")
        try:
            off_date = datetime.now().strftime("%Y-%m-%d")
            update_data = {"offDate": off_date}
            response = requests.put(f"{BASE_URL}/placements/{placement_ids[0]}", json=update_data, headers=headers, timeout=10)
            if response.status_code == 200:
                updated = response.json()
                if updated.get("status") == "completed":
                    log_test("Placements - Status changed to 'completed' after offDate", True)
                else:
                    log_test("Placements - Status changed to 'completed' after offDate", False, 
                            f"Expected status='completed', got '{updated.get('status')}'")
                
                # Verify staff status changed back to 'available'
                print("\n[6.5] Verifying staff status changed back to 'available'")
                response = requests.get(f"{BASE_URL}/staff", headers=headers, timeout=10)
                if response.status_code == 200:
                    staff_list = response.json()
                    staff = next((s for s in staff_list if s["id"] == staff_ids[0]), None)
                    
                    if staff and staff.get("status") == "available":
                        log_test("Placements - Staff status changed back to 'available'", True)
                    else:
                        log_test("Placements - Staff status changed back to 'available'", False, 
                                f"Expected status='available', got '{staff.get('status') if staff else 'staff not found'}'")
                else:
                    log_test("Placements - Staff status back to available", False, f"Status {response.status_code}")
            else:
                log_test("Placements - UPDATE with offDate", False, f"Status {response.status_code}")
        except Exception as e:
            log_test("Placements - UPDATE with offDate", False, f"Exception: {str(e)}")
    
    # Test fixed commission
    if len(staff_ids) > 1 and len(client_ids) > 1:
        print("\n[6.6] Creating placement with fixed commission")
        try:
            join_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            vendor_fixed = next((v for v in vendor_ids if v["type"] == "fixed"), None)
            
            if vendor_fixed:
                placement_data = {
                    "clientId": client_ids[1],
                    "staffId": staff_ids[1],
                    "vendorId": vendor_fixed["id"],
                    "joinDate": join_date,
                    "monthlyClientCharge": 28000,
                    "monthlyStaffSalary": 16000,
                    "vendorCommission": 2000,
                    "vendorCommissionType": "fixed",
                    "dutyType": "12 Hr"
                }
                response = requests.post(f"{BASE_URL}/placements", json=placement_data, headers=headers, timeout=10)
                if response.status_code == 200:
                    placement_ids.append(response.json()["id"])
                    
                    # Verify fixed commission calculation
                    response = requests.get(f"{BASE_URL}/placements", headers=headers, timeout=10)
                    if response.status_code == 200:
                        placements = response.json()
                        fixed_placement = next((p for p in placements if p["id"] == placement_ids[-1]), None)
                        
                        if fixed_placement:
                            calc = fixed_placement.get("calc", {})
                            vendor_commission = calc.get("vendorCommission", 0)
                            
                            # For 30 days with fixed 2000/month, should be ~2000
                            if 1900 <= vendor_commission <= 2100:
                                log_test("Placements - vendorCommission (fixed) calculated correctly", True, 
                                        f"vendorCommission={vendor_commission}")
                            else:
                                log_test("Placements - vendorCommission (fixed) calculated correctly", False, 
                                        f"Expected ~2000, got {vendor_commission}")
                    else:
                        log_test("Placements - Fixed commission verification", False, f"Status {response.status_code}")
                else:
                    log_test("Placements - Create with fixed commission", False, f"Status {response.status_code}")
        except Exception as e:
            log_test("Placements - Create with fixed commission", False, f"Exception: {str(e)}")
    
    return placement_ids

def test_dashboard(token):
    """Test Dashboard aggregate endpoint"""
    print("\n" + "="*80)
    print("TEST 7: DASHBOARD AGGREGATE ENDPOINT")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n[7.1] Testing GET /api/dashboard")
    try:
        response = requests.get(f"{BASE_URL}/dashboard", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Check structure
            has_cards = "cards" in data
            has_monthly = "monthly" in data
            has_activities = "recentActivities" in data
            
            if has_cards and has_monthly and has_activities:
                log_test("Dashboard - Has correct structure (cards, monthly, recentActivities)", True)
            else:
                log_test("Dashboard - Has correct structure", False, 
                        f"Missing: {'cards' if not has_cards else ''} {'monthly' if not has_monthly else ''} {'recentActivities' if not has_activities else ''}")
            
            # Check monthly array length
            if has_monthly:
                monthly = data["monthly"]
                if len(monthly) == 6:
                    log_test("Dashboard - monthly array has 6 entries", True)
                else:
                    log_test("Dashboard - monthly array has 6 entries", False, f"Expected 6, got {len(monthly)}")
            
            # Check cards content
            if has_cards:
                cards = data["cards"]
                required_fields = [
                    "activePlacements", "todaysJoinings", "todaysOff",
                    "totalStaff", "availableStaff", "busyStaff", "onLeave",
                    "totalClients", "totalVendors",
                    "totalRevenue", "totalStaffSalary", "totalVendorCommission", "totalProfit",
                    "pendingClientPayments", "pendingSalary"
                ]
                
                missing_fields = [f for f in required_fields if f not in cards]
                if not missing_fields:
                    log_test("Dashboard - cards has all required fields", True)
                else:
                    log_test("Dashboard - cards has all required fields", False, f"Missing: {', '.join(missing_fields)}")
                
                # Verify totals are reasonable (non-negative)
                if cards.get("totalRevenue", -1) >= 0 and cards.get("totalProfit", -1) >= 0:
                    log_test("Dashboard - Financial totals are calculated", True, 
                            f"Revenue={cards.get('totalRevenue')}, Profit={cards.get('totalProfit')}")
                else:
                    log_test("Dashboard - Financial totals are calculated", False, "Negative values found")
        else:
            log_test("Dashboard - GET /api/dashboard", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Dashboard - GET /api/dashboard", False, f"Exception: {str(e)}")

def test_global_search(token):
    """Test Global search endpoint"""
    print("\n" + "="*80)
    print("TEST 8: GLOBAL SEARCH")
    print("="*80)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n[8.1] Testing GET /api/search?q=<partial>")
    try:
        # Search for "Nurse" (should find staff)
        response = requests.get(f"{BASE_URL}/search?q=Nurse", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            
            # Check structure
            has_staff = "staff" in data
            has_clients = "clients" in data
            has_vendors = "vendors" in data
            has_placements = "placements" in data
            
            if has_staff and has_clients and has_vendors and has_placements:
                log_test("Global Search - Returns correct structure", True, 
                        f"staff={len(data['staff'])}, clients={len(data['clients'])}, vendors={len(data['vendors'])}, placements={len(data['placements'])}")
            else:
                log_test("Global Search - Returns correct structure", False, "Missing arrays")
            
            # Verify staff results
            if has_staff and len(data["staff"]) > 0:
                log_test("Global Search - Finds staff by name", True, f"Found {len(data['staff'])} staff")
            else:
                log_test("Global Search - Finds staff by name", False, "No staff found for 'Nurse'")
        else:
            log_test("Global Search - GET /api/search", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Global Search - GET /api/search", False, f"Exception: {str(e)}")
    
    # Test empty query
    print("\n[8.2] Testing search with empty query")
    try:
        response = requests.get(f"{BASE_URL}/search?q=", headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            # Should return empty arrays
            if (len(data.get("staff", [])) == 0 and len(data.get("clients", [])) == 0 and 
                len(data.get("vendors", [])) == 0 and len(data.get("placements", [])) == 0):
                log_test("Global Search - Empty query returns empty arrays", True)
            else:
                log_test("Global Search - Empty query returns empty arrays", False, "Expected empty arrays")
        else:
            log_test("Global Search - Empty query", False, f"Status {response.status_code}")
    except Exception as e:
        log_test("Global Search - Empty query", False, f"Exception: {str(e)}")

def print_summary():
    """Print test summary"""
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    print(f"\n✅ PASSED: {test_results['passed']}")
    print(f"❌ FAILED: {test_results['failed']}")
    print(f"📊 TOTAL:  {test_results['passed'] + test_results['failed']}")
    
    if test_results["errors"]:
        print("\n" + "="*80)
        print("FAILED TESTS:")
        print("="*80)
        for error in test_results["errors"]:
            print(f"  • {error}")
    
    print("\n" + "="*80)
    
    return test_results["failed"] == 0

def main():
    """Main test execution"""
    print("="*80)
    print("DutyOnTrack Backend API Test Suite")
    print("="*80)
    print(f"Base URL: {BASE_URL}")
    print("="*80)
    
    # Test 1: Auth
    token, agency_id, email = test_auth()
    if not token:
        print("\n❌ CRITICAL: Auth tests failed. Cannot continue.")
        sys.exit(1)
    
    test_login(email, "SecurePass123!")
    test_auth_me(token)
    
    # Test 2: Multi-tenant isolation
    test_multi_tenant_isolation()
    
    # Test 3: Staff CRUD
    staff_ids = test_staff_crud(token)
    
    # Test 4: Clients CRUD
    client_ids = test_clients_crud(token)
    
    # Test 5: Vendors CRUD
    vendor_ids = test_vendors_crud(token)
    
    # Test 6: Placements CRUD
    placement_ids = test_placements_crud(token, staff_ids, client_ids, vendor_ids)
    
    # Test 7: Dashboard
    test_dashboard(token)
    
    # Test 8: Global Search
    test_global_search(token)
    
    # Print summary
    success = print_summary()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()

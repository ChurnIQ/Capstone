
import os
from dotenv import load_dotenv

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Load credentials from .env
load_dotenv()

email = os.getenv("SELENIUM_EMAIL")
password = os.getenv("SELENIUM_PASSWORD")

if not email or not password:
    raise ValueError("Email or password missing in .env file")

# Configure Chrome
options = Options()
options.add_argument("--start-maximized")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 25)

try:
    # STEP 1: Open login page
    print("Opening ChurnIQ login page...")
    driver.get("https://churniq-deployment.vercel.app/login")

    # STEP 2: Enter login credentials
    print("Entering email...")
    wait.until(
        EC.visibility_of_element_located((By.NAME, "email"))
    ).send_keys(email)

    print("Entering password...")
    driver.find_element(By.NAME, "password").send_keys(password)

    # STEP 3: Click Sign In
    print("Clicking Sign In...")
    driver.find_element(
        By.CSS_SELECTOR, "button[type='submit']"
    ).click()

    # STEP 4: Wait for 2FA page
    wait.until(lambda d: "/2fa" in d.current_url)

    print("\n2FA page opened successfully!")
    print("Check your Gmail inbox for the 6-digit OTP.")

    # STEP 5: Read OTP from terminal
    otp = input("\nEnter the 6-digit OTP from Gmail: ").strip()

    if not (otp.isdigit() and len(otp) == 6):
        raise ValueError("Please enter a valid 6-digit OTP.")

    # STEP 6: Enter OTP into website
    otp_field = wait.until(
        EC.visibility_of_element_located((By.NAME, "code"))
    )

    otp_field.send_keys(otp)

    print("OTP entered successfully!")

    # STEP 7: Click Verify
    verify_button = wait.until(
        EC.element_to_be_clickable(
            (By.XPATH, "//button[normalize-space()='Verify']")
        )
    )

    verify_button.click()
    print("Verify button clicked!")

    # STEP 8: Check whether login succeeded
    wait.until(lambda d: "/2fa" not in d.current_url)

    print("\nSUCCESS! 2FA verification completed.")
    print("Current URL:", driver.current_url)
    print("Page title:", driver.title)

    input("\nPress Enter to close Chrome...")

except Exception as e:
    print("\nSELENIUM TEST FAILED:", str(e))
    input("\nPress Enter to close Chrome...")

finally:
    driver.quit()

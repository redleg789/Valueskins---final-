export type BusinessBankConfig = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  accountType: string;
  contactEmail: string;
  contactPhone: string;
  label: string;
};

export function getBusinessBankConfig(): BusinessBankConfig {
  return {
    accountHolderName: process.env.RAZORPAY_BUSINESS_ACCOUNT_HOLDER || 'ValueSkins Test Business',
    bankName: process.env.RAZORPAY_BUSINESS_BANK_NAME || 'Razorpay Test Bank',
    accountNumber: process.env.RAZORPAY_BUSINESS_ACCOUNT_NUMBER || '7000001234567890',
    ifsc: process.env.RAZORPAY_BUSINESS_IFSC || 'HDFC000TEST',
    branch: process.env.RAZORPAY_BUSINESS_BRANCH || 'Bengaluru Sandbox Branch',
    accountType: process.env.RAZORPAY_BUSINESS_ACCOUNT_TYPE || 'current',
    contactEmail: process.env.RAZORPAY_BUSINESS_CONTACT_EMAIL || 'finance+test@valueskins.com',
    contactPhone: process.env.RAZORPAY_BUSINESS_CONTACT_PHONE || '9999999999',
    label: process.env.RAZORPAY_BUSINESS_ACCOUNT_LABEL || 'valueskins-test-settlement',
  };
}

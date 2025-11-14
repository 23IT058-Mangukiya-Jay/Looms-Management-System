import fetch from 'node-fetch';

const testLogin = async () => {
  try {
    console.log('🧪 Testing login API...');
    
    const response = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'owner@looms.com',
        password: 'owner123'
      })
    });
    
    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('✅ Login API test PASSED');
      console.log('🎫 Token generated:', data.token ? 'YES' : 'NO');
      console.log('👤 User data:', data.user ? 'YES' : 'NO');
    } else {
      console.log('❌ Login API test FAILED');
    }
    
  } catch (error) {
    console.error('💥 Test Error:', error.message);
  }
};

testLogin();
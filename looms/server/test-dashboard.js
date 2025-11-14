import fetch from 'node-fetch';

const testDashboard = async () => {
  try {
    console.log('🧪 Testing dashboard API...');
    
    // First login to get a token
    const loginResponse = await fetch('http://127.0.0.1:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'manager@looms.com',
        password: 'manager123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log(`✅ Manager login successful`);
    
    // Test dashboard stats
    const dashboardResponse = await fetch('http://127.0.0.1:5000/api/dashboard/stats', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!dashboardResponse.ok) {
      throw new Error(`Dashboard API failed: ${dashboardResponse.status}`);
    }
    
    const dashboardData = await dashboardResponse.json();
    console.log('\n📊 Dashboard Data for Manager:');
    console.log(`Today's Production:`);
    console.log(`  - Day Shift Earnings: ${dashboardData.data.todayProduction.day.totalEarnings}`);
    console.log(`  - Night Shift Earnings: ${dashboardData.data.todayProduction.night.totalEarnings}`);
    console.log(`  - Total Today Earnings: ${dashboardData.data.todayProduction.total.earnings}`);
    console.log(`Month Production:`);
    console.log(`  - Monthly Earnings: ${dashboardData.data.monthProduction.totalEarnings}`);
    console.log(`  - Monthly Meters: ${dashboardData.data.monthProduction.totalMeters}`);
    
    console.log('\n🎉 Manager can now see earnings data!');
    
  } catch (error) {
    console.error('💥 Test Error:', error.message);
  }
};

testDashboard();
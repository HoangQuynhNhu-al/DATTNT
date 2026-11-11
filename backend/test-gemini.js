
async function testGemini() {
    const response = await fetch(
        "http://localhost:5000/api/chat-assistant",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: "Tôi muốn tặng mẹ quà dịp Tết, mẹ thích đồ trang trí màu đỏ, ngân sách 500 nghìn.",
                currentSlots: {},
                history: []
            })
        }
    );

    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

testGemini().catch(console.error);

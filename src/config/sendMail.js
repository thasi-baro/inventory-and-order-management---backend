import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Cấu hình transporter 
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // Dùng SSL/TLS để gửi mail đc khi deploy
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Hàm gửi mail xác nhận đơn hàng
export const sendOrderConfirmationEmail = async (customerEmail, orderData) => {
  try {
    //Tạo danh sách sản phẩm dưới dạng bảng HTML
    const itemsHTML = orderData.items
      .map(
        (item) => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name || "Sản phẩm"}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${item.price?.toLocaleString("vi-VN")}đ</td>
        </tr>
      `
      )
      .join("");

    const mailOptions = {
      from: `"Cửa hàng của Bảo" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject: `Xác nhận đơn hàng #${orderData.orderCode || orderData._id} thành công!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #10B981; text-align: center;">Cảm ơn bạn đã đặt hàng</h2>
          <p>Xin chào <strong>${orderData.customerName || "quý khách"}</strong>,</p>
          <p>Chúng tôi đã nhận được đơn đặt hàng của bạn và đang tiến hành xử lý. Dưới đây là thông tin chi tiết đơn hàng của bạn:</p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0 0 10px 0;"><strong>Mã đơn hàng:</strong> ${orderData.orderCode || orderData._id}</p>
            <p style="margin: 0;"><strong>Ngày đặt:</strong> ${new Date().toLocaleDateString("vi-VN")}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 10px; text-align: left;">Sản phẩm</th>
                <th style="padding: 10px; text-align: center;">Số lượng</th>
                <th style="padding: 10px; text-align: right;">Giá</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 15px 10px; text-align: right; font-weight: bold; border-top: 2px solid #333;">Tổng thanh toán:</td>
                <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: #EF4444; border-top: 2px solid #333; font-size: 18px;">
                  ${orderData.total_amount?.toLocaleString("vi-VN")}đ
                </td>
              </tr>
            </tfoot>
          </table>

          <p style="text-align: center; color: #6b7280; font-size: 14px;">
            Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua email này.<br>
            Chúc bạn một ngày tốt lành!
          </p>
        </div>
      `,
    };

    // Gửi mail
    await transporter.sendMail(mailOptions);
    console.log(`Đã gửi email xác nhận tới: ${customerEmail}`);
  } catch (error) {
    console.error("Lỗi khi gửi email:", error);
  }
};
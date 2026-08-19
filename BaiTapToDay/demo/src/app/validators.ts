// Tên người nhận: chỉ gồm chữ cái (hoa/thường, có dấu tiếng Việt) và khoảng trắng —
// không cho số hay ký tự đặc biệt.
export const NAME_PATTERN = /^[a-zA-ZÀ-ỹ\s]+$/;

// Số điện thoại Việt Nam: bắt đầu bằng số 0, theo sau là 9–10 chữ số.
export const VN_PHONE_PATTERN = /^0\d{9,10}$/;

// Địa chỉ: phải có cả chữ lẫn số (cho phép khoảng trắng và dấu câu thông thường),
// tránh trường hợp chỉ gõ toàn số hoặc toàn chữ không đủ thông tin giao hàng.
export const ADDRESS_PATTERN = /^(?=.*[a-zA-ZÀ-ỹ])(?=.*\d).+$/;

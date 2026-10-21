INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000001', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'علیرضا ترقی', 'head_icu1', '$2a$08$GKf7oLl83DTqz3AfSn6.u.mDxZhNiyjIFDBEy46Uj8wMi/PiawfBu', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000001' WHERE title = 'ICU 1';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000002', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'زهرا میلادی', 'head_icu2', '$2a$08$yjImJ8bYtu8aQktgn3FRuuqNQUaQyHA.h3m.55xqf1X5gNgkMlH3K', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000002' WHERE title = 'ICU 2';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000003', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'معصومه خیاز', 'head_or', '$2a$08$VTA1DX7fPDrUXVQ6299rrerY2AZMhmXgNHbdQFnCpkC9RiJEi64LS', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000003' WHERE title = 'اتاق عمل';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000004', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'فرخ طاهری', 'head_surgery', '$2a$08$8eKrd9HI/ES3fwrWSej5uOlHXAwqf871c7VtB748xOoAXHNwTnvGy', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000004' WHERE title = 'جراحی';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000005', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'سمیرا میرزایی', 'head_clinic', '$2a$08$kWL.lrZZ0ZcKjUQwe70v8.lvtLixzOW69hRPxTUX85xnXVO/5t8ii', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000005' WHERE title = 'کلینیک';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000006', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'مرجان بادان فیروز', 'head_endo', '$2a$08$nR6peMexnBiHWsp8iGZcyeyQRdm5a1axT4Aq5p0kv8OPfx.4HQB8S', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000006' WHERE title = 'آندوسکوپی';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000007', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'حسن ایرانی', 'head_cssd', '$2a$08$QWksC6SMKHWwk9aMdSiOE.itiXjqe7RZMWlMKINtZSsekoOvjQZ.e', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000007' WHERE title = 'CSSD';
INSERT OR IGNORE INTO users (id, hospital_id, full_name, username, password_hash, role_id, is_active, gender)
VALUES ('f0000000-0000-4000-8000-000000000008', 'dd43b5de-bd17-4245-8dbf-246de3db401d', 'عباس متصدری', 'head_anbar', '$2a$08$7gxlZVMs1n5v0fPIGyQ8/uA22tGJjx2LhT3kSuXqGI5L1p1pgqC7C', '6366aed1-278d-4fd3-b8b9-57e078197f0e', 1, 'زن');
UPDATE nursing_wards SET head_nurse_id = 'f0000000-0000-4000-8000-000000000008' WHERE title = 'انبار';

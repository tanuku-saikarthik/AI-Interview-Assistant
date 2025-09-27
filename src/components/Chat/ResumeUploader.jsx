import React, { useState } from "react";
import { Upload, Button, message, Row, Col, Modal, Form, Input } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useDispatch, useSelector } from "react-redux";
import { addOrUpdateCandidate } from "../../redux/candidateSlice";
import { setActiveCandidate, initSession } from "../../redux/interviewSlice";
import {
  extractTextFromPDF,
  extractTextFromDocx,
  findNameEmailPhone,
} from "../../utils/resumeParser";
import { v4 as uuidv4 } from "uuid";
export default function ResumeUploader() {
  const dispatch = useDispatch();
  const interview = useSelector((s) => s.interview);
  const activeId = interview.activeCandidateId;
  const session = activeId ? interview.sessions[activeId] : null;
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [parsedData, setParsedData] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const beforeUpload = async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx"].includes(ext)) {
      message.error("Only PDF and DOCX supported.");
      return false;
    }
    try {
      let text = "";
      if (ext === "pdf") text = await extractTextFromPDF(file);
      else text = await extractTextFromDocx(file);
      const { name, email, phone } = findNameEmailPhone(text);
      setParsedData({
        name: name || "",
        email: email || "",
        phone: phone || "",
      });
      setResumeFile({ file, text });
      form.setFieldsValue({ name, email, phone });
      setModalVisible(true);
      setFileUploaded(true);
    } catch (e) {
      console.error(e);
      message.error("Failed to parse resume.");
    }
    return false;
  };
  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        const id = uuidv4();
        const candidate = {
          id,
          name: values.name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
          resumeName: resumeFile.file.name,
          resumeText: resumeFile.text,
          createdAt: new Date().toISOString(),
          qas: [],
          score: null,
          summary: null,
        };
        dispatch(addOrUpdateCandidate(candidate));
        dispatch(setActiveCandidate(id));
        dispatch(initSession({ id }));
        message.success("Candidate created successfully.");
        setModalVisible(false);
        setParsedData(null);
        setResumeFile(null);
      })
      .catch((info) => console.log("Validation Failed:", info));
  };
  const handleCancel = () => {
    setModalVisible(false);
    setParsedData(null);
    setResumeFile(null);
    setFileUploaded(false);
  };
  const disableUpload = !!session || fileUploaded;
  return (
    <>
      <Row>
        <Col>
          <Upload
            beforeUpload={beforeUpload}
            showUploadList={false}
            accept=".pdf,.docx"
          >
            <Button disabled={disableUpload} icon={<UploadOutlined />}>
              Upload Resume (PDF/DOCX)
            </Button>
          </Upload>
        </Col>
      </Row>
      <Modal
        title="Verify/Edit Candidate Details"
        visible={modalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        okText="Save Candidate"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, message: "Please enter the candidate name" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Please enter the candidate email" },
              { type: "email", message: "Please enter a valid email" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Phone"
            name="phone"
            rules={[
              { required: true, message: "Please enter the candidate phone" },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

import React, { useState } from "react";
import { Layout, Tabs } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import Interviewee from "./pages/Interviewee";
import Interviewer from "./pages/Interviewer";
const { Header, Content } = Layout;
export default function App() {
  const [activeKey, setActiveKey] = useState("1");
  const tabItems = [
    {
      key: "1",
      label: "Interviewee",
      component: <Interviewee />,
    },
    {
      key: "2",
      label: "Interviewer",
      component: <Interviewer />,
    },
  ];
  return (
    <Layout style={{ minHeight: "100vh", background: "#f4f7fa" }}>
      {}
      <Header
        style={{
          background: "#001529",
          color: "#ffffff",
          fontSize: 20,
          fontWeight: "600",
          letterSpacing: 0.5,
          display: "flex",
          alignItems: "center",
          paddingLeft: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        }}
      >
        Swipe — AI Interview Assistant
      </Header>
      {}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          background: "#ffffff",
          padding: "16px 0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems.map((tab) => ({
            key: tab.key,
            label: (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  padding: "8px 24px",
                }}
              >
                {tab.label}
              </span>
            ),
          }))}
          tabBarStyle={{
            borderBottom: "2px solid transparent",
          }}
          indicator={{
            style: {
              backgroundColor: "#008080",
              height: 3,
              borderRadius: 2,
            },
          }}
        />
      </div>
      {}
      <Content style={{ padding: "32px 48px" }}>
        <div
          style={{
            background: "#ffffff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            minHeight: "70vh",
          }}
        >
          <AnimatePresence mode="wait">
            {tabItems.map(
              (tab) =>
                tab.key === activeKey && (
                  <motion.div
                    key={tab.key}
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -50, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                  >
                    {tab.component}
                  </motion.div>
                )
            )}
          </AnimatePresence>
        </div>
      </Content>
    </Layout>
  );
}

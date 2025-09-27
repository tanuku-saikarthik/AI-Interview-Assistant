import React, { useState } from "react";
import { Card } from "antd";
import { motion, AnimatePresence } from "framer-motion";
import CandidateTable from "../components/Dashboard/CandidateTable";
import AccessModal from "./token";

export default function Interviewer() {
  const [authorized, setAuthorized] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: "32px",
        minHeight: "80vh",
      }}
    >
      <AnimatePresence mode="wait">
        {!authorized ? (
          <motion.div
            key="modal"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ width: "100%", maxWidth: 500 }}
          >
            <Card
              style={{
                borderRadius: 16,
                boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
                padding: 24,
                textAlign: "center",
              }}
            >
              <AccessModal
                visible={!authorized}
                onConfirm={() => setAuthorized(true)}
              />
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{ width: "100%", maxWidth: 1000 }}
          >
            <Card
              style={{
                borderRadius: 16,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                padding: 0,
                overflow: "hidden",
              }}
              bodyStyle={{ padding: 0 }}
            >
              <CandidateTable />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import json
from datetime import datetime

workflow = {
    "name": "Error Handler - AI Agent",
    "nodes": [
        {
            "parameters": {},
            "id": "error-trigger",
            "name": "Error Trigger",
            "type": "n8n-nodes-base.errorTrigger",
            "typeVersion": 1,
            "position": [-600, 240],
        },
        {
            "parameters": {},
            "id": "manual-trigger",
            "name": "Manual Trigger",
            "type": "n8n-nodes-base.manualTrigger",
            "typeVersion": 1,
            "position": [-600, 0],
        },
        {
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": (
                    "return [{ json: { error: { message: 'TypeError: Cannot read properties of undefined (reading \\'select\\')', "
                    "stack: 'TypeError: Cannot read properties of undefined (reading \\'select\\')\\n    at file:///app/src/db/index.js:42:15' }, "
                    "workflow: { id: 'TEST-WORKFLOW', name: 'Test Error Workflow', active: false }, "
                    "execution: { id: 'test-execution-001', mode: 'manual', startedAt: new Date().toISOString() }, "
                    "node: { name: 'Upsert Payments', type: 'n8n-nodes-base.code' } } }];"
                ),
            },
            "id": "test-error",
            "name": "Test Error Payload",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [-400, 0],
        },
        {
            "parameters": {"mode": "passThrough", "output": "main"},
            "id": "merge-input",
            "name": "Merge Inputs",
            "type": "n8n-nodes-base.merge",
            "typeVersion": 2,
            "position": [-400, 160],
        },
        {
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": (
                    "const error = $json.error || {};\n"
                    "const workflow = $json.workflow || {};\n"
                    "const execution = $json.execution || {};\n"
                    "const node = $json.node || {};\n\n"
                    "function normalize(message) {\n"
                    "  if (!message) return '';\n"
                    "  return message\n"
                    "    .replace(/\\d+/g, 'N')\n"
                    "    .replace(/\\\\[\\\\w\\\\/\\\\-\\\\.]+/g, '/PATH')\n"
                    "    .replace(/'[^']+'/g, \"'VALUE'\")\n"
                    "    .replace(/\\n+/g, ' ')\n"
                    "    .replace(/\\s+/g, ' ')\n"
                    "    .trim();\n" "}\n\n"
                    "function classify(message) {\n"
                    "  const msg = (message || '').toLowerCase();\n"
                    "  if (msg.match(/type .* is not assignable|property .* does not exist|cannot find|import/)) {\n"
                    "    return { type: 'typescript', complexity: 'simple', model: 'gpt-5-nano' };\n"
                    "  }\n"
                    "  if (msg.match(/econnrefused|request failed|timeout|404|500|401|403/)) {\n"
                    "    return { type: 'api', complexity: 'medium', model: 'gpt-5-mini' };\n"
                    "  }\n"
                    "  if (msg.match(/database|schema|migration|foreign key|constraint|violates|duplicate/)) {\n"
                    "    return { type: 'database', complexity: 'complex', model: 'gpt-5-codex' };\n"
                    "  }\n"
                    "  if (msg.match(/deadlock|race condition|concurrent|assertion/)) {\n"
                    "    return { type: 'logic', complexity: 'critical', model: 'gpt-4.1' };\n"
                    "  }\n"
                    "  return { type: 'general', complexity: 'medium', model: 'gpt-5-mini' };\n"
                    "}\n\n"
                    "const normalizedMessage = normalize(error.message || '');\n"
                    "const crypto = require('crypto');\n"
                    "const hashString = `${workflow.id || ''}:${node.name || ''}:${normalizedMessage}`;\n"
                    "const errorHash = crypto.createHash('sha256').update(hashString).digest('hex');\n"
                    "const classification = classify(error.message || '');\n\n"
                    "return {\n"
                    "  json: {\n"
                    "    error,\n"
                    "    workflow,\n"
                    "    execution,\n"
                    "    node,\n"
                    "    error_hash: errorHash,\n"
                    "    normalized_message: normalizedMessage,\n"
                    "    error_type: classification.type,\n"
                    "    error_complexity: classification.complexity,\n"
                    "    ai_model: classification.model,\n"
                    "    timestamp: new Date().toISOString()\n"
                    "  }\n"
                    "};"
                ),
            },
            "id": "extract-context",
            "name": "Extract Error Context",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [-200, 160],
        },
        {
            "parameters": {
                "operation": "executeQuery",
                "query": (
                    "SELECT \n"
                    "  error_hash,\n"
                    "  cursor_prompt,\n"
                    "  ai_analysis,\n"
                    "  ai_model_used,\n"
                    "  occurrence_count,\n"
                    "  first_seen,\n"
                    "  last_seen\n"
                    "FROM error_analysis_cache\n"
                    "WHERE error_hash = $1\n"
                    "AND created_at > NOW() - INTERVAL '7 days'"
                ),
                "options": {
                    "queryBatching": "independently",
                    "nodeVersion": 2,
                },
                "additionalFields": {
                    "queryParams": "={{ $json.error_hash }}",
                },
            },
            "id": "check-cache",
            "name": "Check Cache",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.4,
            "position": [20, 160],
            "credentials": {
                "postgres": {
                    "id": "neon_postgres",
                    "name": "Neon PostgreSQL",
                }
            },
        },
        {
            "parameters": {
                "conditions": {
                    "conditions": [
                        {
                            "leftValue": "={{ $json.cursor_prompt }}",
                            "rightValue": "",
                            "operator": {"type": "string", "operation": "notEmpty"},
                        }
                    ],
                    "combinator": "and",
                    "options": {},
                },
            },
            "id": "is-cached",
            "name": "Is Cached?",
            "type": "n8n-nodes-base.if",
            "typeVersion": 2,
            "position": [240, 160],
        },
        {
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": (
                    "const cached = $json;\n"
                    "const context = $item(0, 'Extract Error Context').json;\n"
                    "const summaryHtml = `🔁 <b>ПОВТОРЯЮЩАЯСЯ ОШИБКА</b> (AI токены не потрачены ✅)\\n\\n📋 <b>Workflow:</b> ${context.workflow.name || 'Unknown'}\\n   • ID: <code>${context.workflow.id || 'n/a'}</code>\\n🔴 <b>Node:</b> ${context.node.name || 'Unknown'} (<code>${context.node.type || 'n/a'}</code>)\\n⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}\\n\\n❌ <b>Ошибка:</b>\\n<code>${(context.error.message || 'Unknown error').substring(0, 300)}</code>\\n\\n📊 <b>Статистика:</b>\\n• Всего появлений: <b>${(cached.occurrence_count || 0) + 1}</b>\\n• Первое: ${cached.first_seen ? new Date(cached.first_seen).toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' }) : 'n/a'}\\n• Последнее: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tbilisi' })}\\n• AI модель (кэш): ${cached.ai_model_used || 'unknown'}\\n\\n🔗 <b>View:</b> https://n8n.rentflow.rentals/workflow/${context.workflow.id || ''}/executions/${context.execution.id || ''}`;\n"
                    "return { json: { chat_id: -1003251225615, summary_html: summaryHtml, cursor_prompt: cached.cursor_prompt || 'Промпт не найден в кэше', error_hash: context.error_hash, workflow_id: context.workflow.id || null, workflow_name: context.workflow.name || null, node_name: context.node.name || null, error_message: context.error.message || null, error_type: context.error_type || 'unknown', ai_model: cached.ai_model_used || 'cached', cached: true } };"
                ),
            },
            "id": "format-cached",
            "name": "Format Cached Response",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [460, 40],
        },
        {
            "parameters": {
                "operation": "executeQuery",
                "query": "UPDATE error_analysis_cache SET occurrence_count = occurrence_count + 1, last_seen = NOW(), updated_at = NOW() WHERE error_hash = $1",
                "additionalFields": {"queryParams": "={{ $json.error_hash }}"},
            },
            "id": "update-cache",
            "name": "Update Cache Counter",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.4,
            "position": [660, 20],
            "credentials": {
                "postgres": {"id": "neon_postgres", "name": "Neon PostgreSQL"}
            },
        },
        {
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": (
                    "const context = $item(0, 'Extract Error Context').json;\n"
                    "return { json: { chat_id: -1003251225615, error_hash: context.error_hash, workflow_id: context.workflow.id || null, workflow_name: context.workflow.name || null, node_name: context.node.name || null, error_message: context.error.message || null, error_type: context.error_type || 'unknown', error_complexity: context.error_complexity || 'medium', suggested_model: context.ai_model || 'gpt-5-codex', agent_payload: { error: context.error, workflow: context.workflow, execution: context.execution, node: context.node, classification: { type: context.error_type, complexity: context.error_complexity, suggested_model: context.ai_model } } } };"
                ),
            },
            "id": "build-agent-input",
            "name": "Build Agent Input",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [460, 280],
        },
        {
            "parameters": {
                "instructions": "Ты — Error Handler AI Agent. Тебе передан контекст ошибки workflow n8n в поле agent_payload.\n\nЗадачи:\n1. Проанализируй ошибку и предложи шаги решения.\n2. Сформируй краткое HTML-резюме (summary_html) для Telegram.\n3. Сформируй Cursor промпт (cursor_prompt) — plain text, максимум 3500 символов, перечисли конкретные шаги и файлы.\n4. Укажи, какую модель ты использовал (ai_model_used).\n5. Добавь краткие заметки анализа (ai_notes).\n\nФормат ответа: JSON со свойствами summary_html, cursor_prompt, ai_model_used, ai_notes. \nЕсли данных недостаточно, ясно укажи, что нужно уточнить. Работай на русском языке.",
                "maxIterations": 1
            },
            "id": "ai-agent",
            "name": "AI Agent",
            "type": "n8n-nodes-base.aiAgent",
            "typeVersion": 1,
            "position": [660, 280],
            "credentials": {
                "openAIApi": {"id": "OpenAi account", "name": "OpenAi account"}
            }
        },
        {
            "parameters": {
                "mode": "runOnceForAllItems",
                "jsCode": (
                    "const payload = $item(0, 'Build Agent Input').json;\n"
                    "const raw = $json.summary_html || $json.output || $json.response || $json.data || $json;\n"
                    "let parsed;\n"
                    "if (typeof raw === 'string') {\n"
                    "  try { parsed = JSON.parse(raw); } catch (error) { parsed = { summary_html: raw }; }\n"
                    "} else {\n"
                    "  parsed = raw;\n"
                    "}\n"
                    "const summaryHtml = parsed.summary_html || '⚠️ Не удалось сформировать summary';\n"
                    "const cursorPrompt = parsed.cursor_prompt || 'Не удалось создать промпт';\n"
                    "return { json: { chat_id: payload.chat_id, summary_html: summaryHtml, cursor_prompt: cursorPrompt, error_hash: payload.error_hash, workflow_id: payload.workflow_id, workflow_name: payload.workflow_name, node_name: payload.node_name, error_message: payload.error_message, error_type: payload.error_type, ai_model: parsed.ai_model_used || payload.suggested_model || 'gpt-5-codex', ai_notes: parsed.ai_notes || 'Анализ выполнен AI Agent', cached: false } };"
                ),
            },
            "id": "parse-agent-output",
            "name": "Parse Agent Output",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [880, 280],
        },
        {
            "parameters": {
                "operation": "executeQuery",
                "query": (
                    "INSERT INTO error_analysis_cache (\n"
                    "  error_hash,\n"
                    "  workflow_id,\n"
                    "  workflow_name,\n"
                    "  node_name,\n"
                    "  error_message,\n"
                    "  error_type,\n"
                    "  ai_model_used,\n"
                    "  ai_analysis,\n"
                    "  cursor_prompt,\n"
                    "  estimated_cost,\n"
                    "  occurrence_count,\n"
                    "  first_seen,\n"
                    "  last_seen\n"
                    ") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,1,NOW(),NOW())\n"
                    "ON CONFLICT (error_hash) DO NOTHING"
                ),
                "additionalFields": {
                    "queryParams": "={{ [$json.error_hash,$json.workflow_id,$json.workflow_name,$json.node_name,$json.error_message,$json.error_type,$json.ai_model,$json.ai_notes,$json.cursor_prompt] }}"
                }
            },
            "id": "save-cache",
            "name": "Save to Cache",
            "type": "n8n-nodes-base.postgres",
            "typeVersion": 2.4,
            "position": [1080, 280],
            "credentials": {
                "postgres": {"id": "neon_postgres", "name": "Neon PostgreSQL"}
            }
        },
        {
            "parameters": {
                "chatId": "={{ $json.chat_id }}",
                "text": "={{ $json.summary_html }}",
                "additionalFields": {"parse_mode": "HTML", "disable_web_page_preview": True}
            },
            "id": "send-summary",
            "name": "Send Summary to Telegram",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [880, 40],
            "continueOnFail": True,
            "credentials": {
                "telegramApi": {"id": "telegram_alert_bot", "name": "Telegram Bot (@n8n_alert_geodrive_bot)"}
            }
        },
        {
            "parameters": {
                "chatId": "={{ $json.chat_id }}",
                "text": "```\n{{ $json.cursor_prompt }}\n```",
                "additionalFields": {"parse_mode": "MarkdownV2"}
            },
            "id": "send-prompt",
            "name": "Send Cursor Prompt",
            "type": "n8n-nodes-base.telegram",
            "typeVersion": 1.2,
            "position": [1080, 40],
            "continueOnFail": True,
            "credentials": {
                "telegramApi": {"id": "telegram_alert_bot", "name": "Telegram Bot (@n8n_alert_geodrive_bot)"}
            }
        }
    ],
        "connections": {
        "Error Trigger": {"main": [[{"node": "Merge Inputs", "type": "main", "index": 0}]]},
        "Manual Trigger": {"main": [[{"node": "Test Error Payload", "type": "main", "index": 0}]]},
        "Test Error Payload": {"main": [[{"node": "Merge Inputs", "type": "main", "index": 1}]]},
        "Merge Inputs": {"main": [[{"node": "Extract Error Context", "type": "main", "index": 0}]]},
        "Extract Error Context": {"main": [[{"node": "Check Cache", "type": "main", "index": 0}]]},
        "Check Cache": {"main": [[{"node": "Is Cached?", "type": "main", "index": 0}]]},
        "Is Cached?": {
            "main": [
                [{"node": "Format Cached Response", "type": "main", "index": 0}],
                [{"node": "Build Agent Input", "type": "main", "index": 0}]
            ]
        },
        "Format Cached Response": {
            "main": [
                [{"node": "Update Cache Counter", "type": "main", "index": 0}],
                [{"node": "Send Summary to Telegram", "type": "main", "index": 0}],
                [{"node": "Send Cursor Prompt", "type": "main", "index": 0}]
            ]
        },
        "Build Agent Input": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
        "AI Agent": {"main": [[{"node": "Parse Agent Output", "type": "main", "index": 0}]]},
        "Parse Agent Output": {
            "main": [
                [{"node": "Save to Cache", "type": "main", "index": 0}],
                [{"node": "Send Summary to Telegram", "type": "main", "index": 0}],
                [{"node": "Send Cursor Prompt", "type": "main", "index": 0}]
            ]
        }
    },
    "settings": {"executionOrder": "v1"},
    "triggerCount": 1
}

with open("n8n-workflows/error-handler-ai-agent.json", "w", encoding="utf-8") as f:
    json.dump(workflow, f, ensure_ascii=False, indent=2)


export function qualityFinding(reason:string,stage:string) {
  const finding=(code:string,remediation:string) => ({ code,severity:'blocking',stage,reason,remediation });
  if (reason==='QUALITY_CONTRACT_MISMATCH') return finding('Q001','start_new_run');
  if (reason==='CONFLICT_ARTIFACT_VERSION') return finding('Q002','reload_current_revision');
  if (reason==='ANALYSIS_NO_EVIDENCE') return finding('Q004','provide_relevant_evidence');
  if (reason==='AI_EDIT_LENGTH') return finding('Q005','shorten_within_scope');
  if (reason==='PROVIDER_ANALYSIS_INVALID' || reason==='PROVIDER_OUTPUT_INVALID_JSON' || reason==='VALIDATION_SCHEMA')
    return finding('Q006','regenerate_constrained_output');
  if (reason==='PROVIDER_OUTPUT_TRUNCATED') return finding('Q008','regenerate_smaller_section');
  if (reason==='AI_EDIT_EVIDENCE' || reason==='CONFLICT_ANALYSIS_SOURCE') return finding('Q010','recheck_evidence');
  if (reason.startsWith('PROVIDER_')) return finding('Q012','inspect_provider_status');
  if (reason.startsWith('PERMISSION_')) return finding('Q015','check_authorization');
  return finding('Q014','inspect_run');
}

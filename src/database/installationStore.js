const { prepare } = require('./db');

/**
 * PostgreSQL/SQLite-backed installation store for Bolt.js OAuth.
 * Stores one installation per workspace (team_id).
 */

/**
 * Store a new Slack workspace installation.
 * Called automatically by Bolt.js after a successful OAuth flow.
 * 
 * @param {object} installation - Bolt.js installation object
 */
async function storeInstallation(installation) {
    const teamId = installation.team?.id;
    const teamName = installation.team?.name || null;
    const botToken = installation.bot?.token;
    const botId = installation.bot?.id || null;
    const botUserId = installation.bot?.userId || null;
    const appId = installation.appId || null;
    const enterpriseId = installation.enterprise?.id || null;
    const enterpriseName = installation.enterprise?.name || null;
    const isEnterpriseInstall = installation.isEnterpriseInstall || false;

    if (!teamId || !botToken) {
        throw new Error('Installation missing required team_id or bot_token');
    }

    // Upsert: update if team already exists, insert if new
    const existing = await prepare(
        'SELECT id FROM installations WHERE team_id = ?'
    ).get(teamId);

    if (existing) {
        await prepare(`
            UPDATE installations 
            SET team_name = ?, bot_token = ?, bot_id = ?, bot_user_id = ?,
                app_id = ?, enterprise_id = ?, enterprise_name = ?,
                is_enterprise_install = ?, updated_at = CURRENT_TIMESTAMP
            WHERE team_id = ?
        `).run(
            teamName, botToken, botId, botUserId,
            appId, enterpriseId, enterpriseName,
            isEnterpriseInstall ? 1 : 0, teamId
        );

        console.log(`📦 Updated installation for workspace: ${teamName} (${teamId})`);
    } else {
        await prepare(`
            INSERT INTO installations 
            (team_id, team_name, bot_token, bot_id, bot_user_id, app_id,
             enterprise_id, enterprise_name, is_enterprise_install)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            teamId, teamName, botToken, botId, botUserId, appId,
            enterpriseId, enterpriseName, isEnterpriseInstall ? 1 : 0
        );

        console.log(`📦 New installation for workspace: ${teamName} (${teamId})`);
    }
}

/**
 * Fetch installation for a workspace.
 * Called by Bolt.js to authorize incoming events/actions.
 * 
 * @param {object} installQuery - { teamId, enterpriseId, isEnterpriseInstall }
 * @returns {object} Installation object compatible with Bolt.js
 */
async function fetchInstallation(installQuery) {
    const { teamId, enterpriseId, isEnterpriseInstall } = installQuery;

    let row;
    if (isEnterpriseInstall && enterpriseId) {
        row = await prepare(
            'SELECT * FROM installations WHERE enterprise_id = ? AND is_enterprise_install = 1'
        ).get(enterpriseId);
    } else if (teamId) {
        row = await prepare(
            'SELECT * FROM installations WHERE team_id = ?'
        ).get(teamId);
    }

    if (!row) {
        throw new Error(`No installation found for team ${teamId || enterpriseId}`);
    }

    // Block deactivated workspaces
    if (row.active === 0) {
        throw new Error(`Workspace ${row.team_name || teamId} has been deactivated`);
    }

    return {
        team: { id: row.team_id, name: row.team_name },
        enterprise: row.enterprise_id
            ? { id: row.enterprise_id, name: row.enterprise_name }
            : undefined,
        bot: {
            token: row.bot_token,
            id: row.bot_id,
            userId: row.bot_user_id,
        },
        appId: row.app_id,
        isEnterpriseInstall: !!row.is_enterprise_install,
    };
}

/**
 * Delete installation for a workspace (used on app_uninstalled event).
 * 
 * @param {object} installQuery - { teamId, enterpriseId }
 */
async function deleteInstallation(installQuery) {
    const { teamId, enterpriseId, isEnterpriseInstall } = installQuery;

    if (isEnterpriseInstall && enterpriseId) {
        await prepare(
            'DELETE FROM installations WHERE enterprise_id = ?'
        ).run(enterpriseId);
    } else if (teamId) {
        await prepare(
            'DELETE FROM installations WHERE team_id = ?'
        ).run(teamId);
    }

    console.log(`📦 Removed installation for: ${teamId || enterpriseId}`);
}

/**
 * Get the bot token for a specific team.
 * Used by the API layer when posting comments back to Slack.
 * 
 * @param {string} teamId - Slack team/workspace ID
 * @returns {string|null} Bot token or null
 */
async function getBotTokenForTeam(teamId) {
    if (!teamId) return null;

    const row = await prepare(
        'SELECT bot_token, active FROM installations WHERE team_id = ?'
    ).get(teamId);

    // Don't return token for deactivated workspaces
    if (!row || row.active === 0) return null;

    return row.bot_token || null;
}

/**
 * Get all installations (for admin/debug purposes).
 * @returns {object[]} Array of installation records
 */
async function getAllInstallations() {
    return await prepare('SELECT team_id, team_name, app_id, active, installed_at, updated_at FROM installations').all();
}

/**
 * Toggle workspace active status.
 * @param {string} teamId - Slack team/workspace ID
 * @param {boolean} active - true to activate, false to deactivate
 */
async function setWorkspaceActive(teamId, active) {
    await prepare(
        'UPDATE installations SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE team_id = ?'
    ).run(active ? 1 : 0, teamId);
    console.log(`📦 Workspace ${teamId} set to ${active ? 'ACTIVE' : 'INACTIVE'}`);
}

/**
 * Get the exact team name for a given team ID.
 * @param {string} teamId - Slack team/workspace ID
 * @returns {string|null} Team name or null
 */
async function getTeamName(teamId) {
    if (!teamId) return null;
    const row = await prepare('SELECT team_name FROM installations WHERE team_id = ?').get(teamId);
    return row ? row.team_name : null;
}

module.exports = {
    storeInstallation,
    fetchInstallation,
    deleteInstallation,
    getBotTokenForTeam,
    getAllInstallations,
    setWorkspaceActive,
    getTeamName,
};

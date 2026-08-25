const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CONEXÃO SUPABASE COM VARIÁVEIS DE AMBIENTE
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("⚠️ ERRO: Chaves do Supabase não configuradas nas variáveis de ambiente!");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Inscrição
app.post('/api/inscrever', async (req, res) => {
    const { nome, cpf, whatsapp } = req.body;
    if (!nome || !cpf || !whatsapp) return res.status(400).json({ erro: 'Preencha todos os campos!' });

    const cpfLimpo = cpf.replace(/\D/g, '');

    const { data, error } = await supabase
        .from('inscritos')
        .insert([{ nome, cpf: cpfLimpo, whatsapp }])
        .select();

    if (error) {
        if (error.code === '23505') return res.status(400).json({ erro: 'Este CPF já está cadastrado!' });
        return res.status(500).json({ erro: 'Erro ao salvar inscrição.' });
    }

    res.status(201).json({ mensagem: 'Sucesso', vaga: data[0].id });
});

// 2. Buscar por CPF
app.get('/api/ingresso/:cpf', async (req, res) => {
    const cpfBusca = req.params.cpf.replace(/\D/g, '');

    const { data, error } = await supabase
        .from('inscritos')
        .select('id, nome, cpf')
        .eq('cpf', cpfBusca)
        .single();

    if (error || !data) return res.status(404).json({ erro: 'Inscrição não encontrada.' });

    res.json(data);
});

// 3. Listar todos (Admin)
app.get('/api/admin/listar', async (req, res) => {
    const { data, error } = await supabase
        .from('inscritos')
        .select('*')
        .order('id', { ascending: false });

    if (error) return res.status(500).json({ erro: 'Erro ao buscar inscritos.' });

    const dadosFormatados = data.map(u => ({
        ...u,
        cpf: u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    }));

    res.json(dadosFormatados);
});

// 4. NOVO: Excluir Inscrição
app.delete('/api/admin/deletar/:id', async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('inscritos')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ erro: 'Erro ao deletar inscrição.' });

    res.json({ mensagem: 'Inscrição removida com sucesso!' });
});

// 5. Rota para Sorteio
app.get('/api/sorteio/participantes', async (req, res) => {
    const { data, error } = await supabase
        .from('inscritos')
        .select('id, nome');

    if (error) return res.status(500).json({ erro: 'Erro ao buscar participantes.' });
    if (data.length === 0) return res.status(404).json({ erro: 'Nenhum inscrito.' });

    res.json(data);
});

// Rota para exportar CSV (Excel)
app.get('/api/admin/exportar', async (req, res) => {
    const { data, error } = await supabase
        .from('inscritos')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        return res.status(500).send('Erro ao buscar dados');
    }

    // Cria o cabeçalho da planilha
    let csv = 'ID,Nome,CPF,Email,Status\n';

    // Preenche as linhas com os dados
    data.forEach(row => {
        const status = row.presente ? 'Presente' : 'Ausente';
        csv += `${row.id},"${row.nome}","${row.cpf}","${row.email}","${status}"\n`;
    });

    // Configura o navegador para baixar o arquivo
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('inscritos_senai.csv');
    return res.send(csv);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Supabase rodando na porta ${PORT}`);
});
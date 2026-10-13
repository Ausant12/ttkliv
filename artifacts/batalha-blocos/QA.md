# Revisão da Batalha dos Blocos

## Resultado

24 testes da batalha passaram. A suíte dos três jogos passou em 33 testes.
Seis cenários completos passaram em cada um dos dois perfis do Electron:
perfil padrão e perfil sem aceleração GPU, como no launcher do projeto.
Não houve erros de console ou arquivos ausentes nos cenários concluídos.

## Correções

- Quantidades inválidas de presentes de teste são rejeitadas.
- Seguidores e presentes já registrados não voltam a pontuar após mil entradas.
- Presentes comuns são reconhecidos pelo nome quando o ID está ausente.
- Presentes que não são de sequência não são descartados por `repeatEnd: false` nem pelo grupo compartilhado.
- Exceções nos quadros da animação rejeitam a operação; blocos não depositados ficam na fila para o próximo evento retomar, sem repetir os já depositados.
- Canais de áudio usam um identificador de reprodução para impedir que uma resposta antiga libere um canal em uso.
- Os símbolos das torres continuam visíveis durante a subida da câmera; filtros de imagens extensas foram removidos.
- O jogo tem um favicon local.

## Eventos e funcionamento

Os testes cobrem todos os dez presentes, quantidades e aliases; sequência em andamento e final duplicado; seguidores únicos; pacotes e saldo de curtidas; comentários 13 e 22; ações inválidas; meta de 500; excedentes de presentes de 6.000; alternância da fila; retomada após falha; canais de áudio; contagem real de pisos e câmera.

O teste de rajada mistura 1.000 ações válidas com 250 notificações de presente duplicadas: todos os blocos aceitos são depositados e as duplicações não pontuam.

Os cenários completos usam um servidor Express/Socket.IO local e o código completo do jogo. Incluem 40 comentários, ações durante a vitória, duas vitórias de um presente premium, redimensionamento durante quedas, carregamento dos assets, limpeza de efeitos temporários e vídeo sem áudio em loop. Os pontos coincidem com a quantidade de pisos após cada cenário.

## Velocidade medida

Teste com seis presentes recebidos em rajada: 530 blocos, sem vitória no intervalo medido.

| Perfil | Tempo até esvaziar a fila | Quadros medidos | Intervalo entre quadros, P95 | Maior intervalo |
| --- | ---: | ---: | ---: | ---: |
| Padrão | 6.284 ms | 342 | 33 ms | 50 ms |
| Sem aceleração GPU | 6.412 ms | 352 | 33 ms | 117 ms |

A média no intervalo foi aproximadamente 54–55 quadros por segundo. Há oscilações; o teste não demonstra 60 FPS constantes. O tempo da fila inclui a duração intencional das quedas. Cada celebração de vitória acrescenta 2,6 segundos, então presentes de 6.000 produzem doze rodadas e levam mais tempo.

Os detalhes de cada cenário estão em `qa-padrao.json` e `qa-software.json`.

## Repetir

Na pasta `ttkliv`:

```powershell
node --test tests/batalha-blocos-events.test.js tests/batalha-videos-sequence.test.js tests/duelo-2d-events.test.js
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath '.\node_modules\electron\dist\electron.exe' -ArgumentList 'tests/batalha-blocos-browser.cjs --software' -WindowStyle Hidden -Wait
```

Para o perfil padrão, omita `--software`. O teste abre apenas uma janela oculta e usa eventos simulados. Não conecta ao TikTok e não envia nem compra presentes.

## Limites da validação

Não foi usada uma LIVE real. Os testes verificam carregamento e estado dos áudios, não a qualidade sonora percebida. A velocidade depende da máquina, do navegador, do vídeo de fundo e da carga da transmissão. Estes resultados não garantem ausência de qualquer bug em situações não testadas.

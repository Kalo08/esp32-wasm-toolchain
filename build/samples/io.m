a = arduino();
configurePin(a, 'D14', 'Pullup');
playTone(a, 'D5', 440, 0.2);
writePWMDutyCycle(a, 'D6', 0.5);
writePWMVoltage(a, 'D6', 1.65);
x = rand(1, 3);
tic
pause(0.01);
e = toc;
v = readVoltage(a, 'D10');
if readDigitalPin(a, 'D14') == 0
    writeRGB(a, [40 0 0]);
end
fprintf('%d values, %.3f s, %.2f V\n', numel(x), e, v);
disp(sum(x) > 0)
